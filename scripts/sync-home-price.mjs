import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const DATA_PATH = 'data/home-price.json';
const APARTMENT = {
  name: '힐스테이트 푸르지오 수원',
  address: '경기도 수원시 팔달구 효원로93번길 33',
  lawdCd: process.env.MOLIT_LAWD_CD || '41115'
};
const SERVICE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';

function kstDate(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function formatKstTimestamp(date = new Date()) {
  const kst = kstDate(date);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  const hours = String(kst.getUTCHours()).padStart(2, '0');
  const minutes = String(kst.getUTCMinutes()).padStart(2, '0');
  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ' KST';
}

function recentMonths() {
  const now = kstDate();
  return [0, 1, 2].map((offset) => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    return month.getUTCFullYear() + String(month.getUTCMonth() + 1).padStart(2, '0');
  });
}

function cutoffDate() {
  const now = kstDate();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
}

function decodeXml(value = '') {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

function tagValue(source, names) {
  for (const name of names) {
    const match = source.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
    if (match) return decodeXml(match[1]);
  }
  return '';
}

function normalizedName(name = '') {
  return name.replace(/[\s·ㆍ-]/g, '').toLowerCase();
}

function parseTransactions(xml) {
  const records = [];
  const apartmentName = normalizedName(APARTMENT.name);
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const item = match[1];
    const name = tagValue(item, ['aptNm', 'aptName']);
    if (normalizedName(name) !== apartmentName) continue;

    const year = tagValue(item, ['dealYear', 'contractYear']);
    const month = tagValue(item, ['dealMonth', 'contractMonth']).padStart(2, '0');
    const day = tagValue(item, ['dealDay', 'contractDay']).padStart(2, '0');
    const priceManwon = Number(tagValue(item, ['dealAmount', 'dealAmt']).replace(/[^0-9]/g, ''));
    const areaSqm = Number(tagValue(item, ['excluUseAr', 'excluUseArea']));
    const floor = Number(tagValue(item, ['floor']));
    const contractDate = year && month && day ? year + '-' + month + '-' + day : '';
    const parsedDate = contractDate ? new Date(contractDate + 'T00:00:00Z') : null;

    if (!contractDate || !Number.isFinite(priceManwon) || !parsedDate || parsedDate < cutoffDate()) continue;
    records.push({ contractDate, priceManwon, areaSqm: Number.isFinite(areaSqm) ? areaSqm : null, floor: Number.isFinite(floor) ? floor : null });
  }

  return records.sort((left, right) => right.contractDate.localeCompare(left.contractDate));
}

async function fetchTransactions(serviceKey) {
  const decodedKey = decodeURIComponent(serviceKey);
  const responses = await Promise.all(recentMonths().map(async (yearMonth) => {
    const url = new URL(SERVICE_URL);
    url.searchParams.set('serviceKey', decodedKey);
    url.searchParams.set('LAWD_CD', APARTMENT.lawdCd);
    url.searchParams.set('DEAL_YMD', yearMonth);
    url.searchParams.set('numOfRows', '1000');
    url.searchParams.set('pageNo', '1');
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok || !/<resultCode>00<\/resultCode>/.test(body)) throw new Error('국토교통부 실거래가 API 요청에 실패했습니다.');
    return parseTransactions(body);
  }));

  const records = responses.flat().sort((left, right) => right.contractDate.localeCompare(left.contractDate));
  const prices = records.map((record) => record.priceManwon);
  return {
    status: records.length ? 'ok' : 'empty',
    message: records.length ? '' : '최근 3개월 내 단지명과 일치하는 신고 거래가 없어요.',
    periodLabel: '최근 3개월 계약일 기준 · ' + records.length + '건',
    summary: records.length ? {
      count: records.length,
      averagePriceManwon: Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length),
      minPriceManwon: Math.min(...prices),
      maxPriceManwon: Math.max(...prices),
      latestPriceManwon: records[0].priceManwon
    } : null,
    records
  };
}

function normalizeListing(item) {
  const priceManwon = Number(item.priceManwon ?? item.priceInManwon ?? item.price ?? item.dealOrWarrantPrc);
  return {
    title: String(item.title ?? item.articleName ?? item.articleNo ?? '현재 매물'),
    tradeType: String(item.tradeType ?? item.tradeTypeName ?? item.tradeTypeCode ?? '매매'),
    priceManwon: Number.isFinite(priceManwon) ? priceManwon : null,
    areaSqm: Number(item.areaSqm ?? item.exclusiveArea ?? item.area1) || null,
    floor: Number(item.floor ?? item.floorInfo) || null
  };
}

async function fetchCurrentListings() {
  const endpoint = process.env.LISTINGS_API_URL;
  if (!endpoint) {
    return {
      status: 'not_configured',
      sourceName: '허용된 매물 데이터 제공자 연결 대기',
      message: '반복 수집이 허용된 매물 데이터 API를 연결하면 현재 매물가를 표시합니다.',
      syncedAt: null,
      items: []
    };
  }

  try {
    const headers = { Accept: 'application/json' };
    if (process.env.LISTINGS_API_TOKEN) headers.Authorization = 'Bearer ' + process.env.LISTINGS_API_TOKEN;
    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error('매물 데이터 요청에 실패했습니다.');
    const payload = await response.json();
    const rawItems = Array.isArray(payload) ? payload : (payload.items ?? payload.listings ?? []);
    const items = rawItems.map(normalizeListing).filter((item) => item.priceManwon);
    return {
      status: 'ok',
      sourceName: process.env.LISTINGS_SOURCE_NAME || '연결된 매물 데이터 제공자',
      message: '',
      syncedAt: formatKstTimestamp(),
      items
    };
  } catch (error) {
    return {
      status: 'error',
      sourceName: process.env.LISTINGS_SOURCE_NAME || '연결된 매물 데이터 제공자',
      message: '현재 매물 정보를 가져오지 못했어요. 다음 동기화 때 다시 시도합니다.',
      syncedAt: null,
      items: []
    };
  }
}

async function readExistingData() {
  try {
    return JSON.parse(await readFile(DATA_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  const previous = await readExistingData();
  const serviceKey = process.env.MOLIT_SERVICE_KEY;
  let recentTransactions;

  if (!serviceKey) {
    recentTransactions = previous.recentTransactions?.records?.length ? previous.recentTransactions : {
      status: 'waiting_for_secret',
      message: '국토교통부 실거래가 API 키를 등록하면 최근 3개월 가격을 동기화합니다.',
      periodLabel: '동기화 후 최근 3개월 거래를 표시합니다.',
      summary: null,
      records: []
    };
  } else {
    try {
      recentTransactions = await fetchTransactions(serviceKey);
    } catch (error) {
      recentTransactions = {
        ...(previous.recentTransactions || {}),
        status: 'error',
        message: '공식 실거래가를 불러오지 못했어요. 다음 동기화 때 다시 시도합니다.'
      };
    }
  }

  const currentListings = await fetchCurrentListings();
  const didSyncOfficialTrades = Boolean(serviceKey) && recentTransactions.status !== 'error';
  const data = {
    apartment: APARTMENT,
    sync: {
      schedule: '매일 14:00 KST',
      lastSuccessfulAt: didSyncOfficialTrades ? formatKstTimestamp() : previous.sync?.lastSuccessfulAt || null
    },
    recentTransactions,
    currentListings
  };

  await mkdir('data', { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
