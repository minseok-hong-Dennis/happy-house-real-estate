import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const HOME_DATA_PATH = 'data/home-price.json';
const RECONSTRUCTION_DATA_PATH = 'data/reconstruction.json';
const SERVICE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const HOME_APARTMENT = {
  name: '힐스테이트 푸르지오 수원',
  address: '경기도 수원시 팔달구 효원로93번길 33',
  lawdCd: process.env.MOLIT_LAWD_CD || '41115',
  matchNames: ['힐스테이트푸르지오수원']
};
const RECONSTRUCTION_TARGETS = [
  {
    id: 'yeongtong-2',
    name: '영통2구역 · 매탄주공4단지',
    location: '수원시 영통구 매탄동',
    lawdCd: '41117',
    matchNames: ['매탄주공4단지', '매탄주공4'],
    stage: '이주 · 철거 단계',
    milestone: '이주·철거 마무리 단계 보도',
    remainingEstimate: '준공까지 약 2~4년 추정',
    sourceUrl: 'https://wonnam.co.kr/yeongtong-2-district-xi-ipark-2026-location-analysis/',
    sourceLabel: '진행 정보 보기'
  },
  {
    id: 'gwacheon-10',
    name: '과천주공10단지',
    location: '과천시 중앙동',
    lawdCd: '41290',
    matchNames: ['과천주공10단지', '주공10단지'],
    stage: '조합 운영 · 이주 준비',
    milestone: '2027년 5월 이주 계획 보도',
    remainingEstimate: '이주까지 약 1년 · 입주는 이후 일정 확인',
    sourceUrl: 'https://realty.chosun.com/site/data/html_dir/2025/04/03/2025040301944.html',
    sourceLabel: '진행 정보 보기'
  },
  {
    id: 'sanbon-11',
    name: '산본11구역 · 산본주공11단지',
    location: '군포시 산본동',
    lawdCd: '41410',
    matchNames: ['산본주공11단지', '주공11단지'],
    stage: '주민대표회의 구성 승인',
    milestone: '2026년 6월 구성 승인 보도',
    remainingEstimate: '준공까지 약 6~8년 이상 추정',
    sourceUrl: 'https://newstown.co.kr/news/articleView.html?idxno=705409',
    sourceLabel: '진행 정보 보기'
  },
  {
    id: 'bundang-yangji',
    name: '분당 양지마을 통합 · 금호1단지',
    location: '성남시 분당구 수내동',
    lawdCd: '41135',
    matchNames: ['양지마을1단지금호', '금호1단지'],
    stage: '통합 재건축 계획 조율',
    milestone: '단지별 통합 방식 조율 진행',
    remainingEstimate: '준공까지 약 7~10년 이상 추정',
    sourceUrl: 'https://v.daum.net/v/prfWglQ9Ww',
    sourceLabel: '진행 정보 보기'
  }
];

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

function recentMonths(monthCount = 3) {
  const now = kstDate();
  return Array.from({ length: monthCount }, (_, offset) => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    return month.getUTCFullYear() + String(month.getUTCMonth() + 1).padStart(2, '0');
  });
}

function cutoffDate(monthCount = 3) {
  const now = kstDate();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthCount - 1), 1));
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

function matchesTarget(name, target) {
  const normalized = normalizedName(name);
  return target.matchNames.some((candidate) => {
    const expected = normalizedName(candidate);
    return normalized === expected || normalized.includes(expected) || expected.includes(normalized);
  });
}

function parseTransactions(xml, target, cutoff) {
  const records = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const item = match[1];
    const name = tagValue(item, ['aptNm', 'aptName']);
    if (!matchesTarget(name, target)) continue;
    const year = tagValue(item, ['dealYear', 'contractYear']);
    const month = tagValue(item, ['dealMonth', 'contractMonth']).padStart(2, '0');
    const day = tagValue(item, ['dealDay', 'contractDay']).padStart(2, '0');
    const priceManwon = Number(tagValue(item, ['dealAmount', 'dealAmt']).replace(/[^0-9]/g, ''));
    const areaSqm = Number(tagValue(item, ['excluUseAr', 'excluUseArea']));
    const floor = Number(tagValue(item, ['floor']));
    const contractDate = year && month && day ? year + '-' + month + '-' + day : '';
    const parsedDate = contractDate ? new Date(contractDate + 'T00:00:00Z') : null;
    if (!contractDate || !Number.isFinite(priceManwon) || !parsedDate || parsedDate < cutoff) continue;
    records.push({ apartmentName: name, contractDate, priceManwon, areaSqm: Number.isFinite(areaSqm) ? areaSqm : null, floor: Number.isFinite(floor) ? floor : null });
  }
  return records.sort((left, right) => right.contractDate.localeCompare(left.contractDate));
}

function summarizeTransactions(records) {
  const prices = records.map((record) => record.priceManwon);
  return records.length ? {
    count: records.length,
    averagePriceManwon: Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length),
    minPriceManwon: Math.min(...prices),
    maxPriceManwon: Math.max(...prices),
    latestPriceManwon: records[0].priceManwon
  } : null;
}

async function fetchTransactions(serviceKey, target, monthCount = 3) {
  const decodedKey = decodeURIComponent(serviceKey);
  const cutoff = cutoffDate(monthCount);
  const responses = await Promise.all(recentMonths(monthCount).map(async (yearMonth) => {
    const url = new URL(SERVICE_URL);
    url.searchParams.set('serviceKey', decodedKey);
    url.searchParams.set('LAWD_CD', target.lawdCd);
    url.searchParams.set('DEAL_YMD', yearMonth);
    url.searchParams.set('numOfRows', '1000');
    url.searchParams.set('pageNo', '1');
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok || !/<resultCode>00<\/resultCode>/.test(body)) throw new Error('국토교통부 실거래가 API 요청에 실패했습니다.');
    return parseTransactions(body, target, cutoff);
  }));
  const records = responses.flat().sort((left, right) => right.contractDate.localeCompare(left.contractDate));
  return {
    status: records.length ? 'ok' : 'empty',
    message: records.length ? '' : '최근 ' + monthCount + '개월 내 단지명과 일치하는 신고 거래가 없어요.',
    periodLabel: '최근 ' + monthCount + '개월 계약일 기준 · ' + records.length + '건',
    summary: summarizeTransactions(records),
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
  if (!endpoint) return { status: 'not_configured', sourceName: '허용된 매물 데이터 제공자 연결 대기', message: '반복 수집이 허용된 매물 데이터 API를 연결하면 최신 매물가를 표시합니다.', syncedAt: null, items: [] };
  try {
    const headers = { Accept: 'application/json' };
    if (process.env.LISTINGS_API_TOKEN) headers.Authorization = 'Bearer ' + process.env.LISTINGS_API_TOKEN;
    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error('매물 데이터 요청에 실패했습니다.');
    const payload = await response.json();
    const rawItems = Array.isArray(payload) ? payload : (payload.items ?? payload.listings ?? []);
    return { status: 'ok', sourceName: process.env.LISTINGS_SOURCE_NAME || '연결된 매물 데이터 제공자', message: '', syncedAt: formatKstTimestamp(), items: rawItems.map(normalizeListing).filter((item) => item.priceManwon) };
  } catch (error) {
    return { status: 'error', sourceName: process.env.LISTINGS_SOURCE_NAME || '연결된 매물 데이터 제공자', message: '현재 매물 정보를 가져오지 못했어요. 다음 동기화 때 다시 시도합니다.', syncedAt: null, items: [] };
  }
}

async function readExistingData(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
}

function waitingReconstructionItem(target, previousItem) {
  return {
    ...target,
    priceStatus: previousItem?.priceStatus === 'ok' ? 'ok' : 'waiting_for_secret',
    priceMessage: previousItem?.latestTransaction ? '' : '국토교통부 API 키 등록 후 최근 12개월 실거래가를 표시합니다.',
    latestTransaction: previousItem?.latestTransaction || null
  };
}

async function syncReconstruction(serviceKey, previous) {
  if (!serviceKey) {
    return {
      status: 'waiting_for_secret',
      sync: { lastSuccessfulAt: previous.sync?.lastSuccessfulAt || null, message: '국토교통부 API 키를 등록하면 최근 12개월 실거래가를 동기화합니다.' },
      items: RECONSTRUCTION_TARGETS.map((target) => waitingReconstructionItem(target, previous.items?.find((item) => item.id === target.id)))
    };
  }
  const items = [];
  for (const target of RECONSTRUCTION_TARGETS) {
    try {
      const trades = await fetchTransactions(serviceKey, target, 12);
      items.push({ ...target, priceStatus: trades.status, priceMessage: trades.message, latestTransaction: trades.records[0] || null });
    } catch {
      const previousItem = previous.items?.find((item) => item.id === target.id);
      items.push({ ...target, priceStatus: 'error', priceMessage: '최근 실거래가를 불러오지 못했어요.', latestTransaction: previousItem?.latestTransaction || null });
    }
  }
  const hasError = items.some((item) => item.priceStatus === 'error');
  return {
    status: hasError ? 'error' : 'ok',
    sync: { lastSuccessfulAt: hasError ? previous.sync?.lastSuccessfulAt || null : formatKstTimestamp(), message: hasError ? '일부 단지의 실거래가를 불러오지 못했어요.' : '' },
    items
  };
}

async function main() {
  const previousHome = await readExistingData(HOME_DATA_PATH);
  const previousReconstruction = await readExistingData(RECONSTRUCTION_DATA_PATH);
  const serviceKey = process.env.MOLIT_SERVICE_KEY;
  let recentTransactions;
  if (!serviceKey) {
    recentTransactions = previousHome.recentTransactions?.records?.length ? previousHome.recentTransactions : { status: 'waiting_for_secret', message: '국토교통부 실거래가 API 키를 등록하면 최근 3개월 가격을 동기화합니다.', periodLabel: '동기화 후 최근 3개월 거래를 표시합니다.', summary: null, records: [] };
  } else {
    try {
      recentTransactions = await fetchTransactions(serviceKey, HOME_APARTMENT);
    } catch {
      recentTransactions = { ...(previousHome.recentTransactions || {}), status: 'error', message: '공식 실거래가를 불러오지 못했어요. 다음 동기화 때 다시 시도합니다.' };
    }
  }

  const reconstruction = await syncReconstruction(serviceKey, previousReconstruction);
  const currentListings = await fetchCurrentListings();
  const didSyncOfficialTrades = Boolean(serviceKey) && recentTransactions.status !== 'error';
  const homeData = {
    apartment: HOME_APARTMENT,
    sync: { schedule: '매일 14:00 KST', lastSuccessfulAt: didSyncOfficialTrades ? formatKstTimestamp() : previousHome.sync?.lastSuccessfulAt || null },
    recentTransactions,
    currentListings
  };
  await mkdir('data', { recursive: true });
  await writeFile(HOME_DATA_PATH, JSON.stringify(homeData, null, 2) + '\n', 'utf8');
  await writeFile(RECONSTRUCTION_DATA_PATH, JSON.stringify(reconstruction, null, 2) + '\n', 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
