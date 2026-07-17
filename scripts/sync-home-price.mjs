import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const HOME_DATA_PATH = 'data/home-price.json';
const RECONSTRUCTION_DATA_PATH = 'data/reconstruction.json';
const SERVICE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const RECONSTRUCTION_API_URL = 'https://api.odcloud.kr/api/15160169/v1/uddi:4d7f16a9-b0fd-4d07-b266-d0ad82aeaf34';
const RECONSTRUCTION_CSV_URL = 'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003667489&fileDetailSn=1&insertDataPrcus=N';
const RECONSTRUCTION_SOURCE_URL = 'https://www.data.go.kr/data/15160169/fileData.do';
const SOUTHERN_GYEONGGI_CITIES = new Set(['수원시', '용인시', '성남시', '안양시', '과천시', '군포시', '의왕시', '안산시', '화성시', '오산시', '평택시', '광주시']);
const HOME_APARTMENT = {
  name: '힐스테이트 푸르지오 수원',
  address: '경기도 수원시 팔달구 효원로93번길 33',
  lawdCd: process.env.MOLIT_LAWD_CD || '41115',
  matchNames: ['힐스테이트푸르지오수원'],
  areaLabel: '전용 59㎡형',
  areaRangeSqm: { min: 59, max: 60 }
};
const CURATED_RECONSTRUCTION_TARGETS = [
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
    sourceLabel: '진행 정보 보기',
    projectType: '재건축(공동주택)',
    supplyHouseholds: null
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
    sourceLabel: '진행 정보 보기',
    projectType: '재건축(공동주택)',
    supplyHouseholds: 1339,
    officialZoneName: '주공10단지구역'
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
    sourceLabel: '진행 정보 보기',
    projectType: '재건축(공동주택)',
    supplyHouseholds: 3892,
    officialZoneName: '군포산본11'
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
    sourceLabel: '진행 정보 보기',
    projectType: '재건축(공동주택)',
    supplyHouseholds: null
  }
];

const PROJECT_TRADE_OVERRIDES = new Map([
  ['평택시|합정주공', { lawdCd: '41220', matchNames: ['합정주공'] }],
  ['평택시|송원,현대연립', { lawdCd: '41220', matchNames: ['송원연립', '현대연립'] }],
  ['의왕시|부곡다구역(우성5차아파트)', { lawdCd: '41430', matchNames: ['우성5차'] }],
  ['과천시|주공8,9단지구역', { lawdCd: '41290', matchNames: ['주공8단지', '주공9단지'] }],
  ['과천시|주공10단지구역', { lawdCd: '41290', matchNames: ['과천주공10단지', '주공10단지'] }],
  ['과천시|주공4단지구역', { lawdCd: '41290', matchNames: ['과천주공4단지', '주공4단지'] }],
  ['평택시|서정3(송탄서정주공3단지아파트)', { lawdCd: '41220', matchNames: ['송탄서정주공3단지', '서정주공3단지'] }],
  ['과천시|과천주공5단지', { lawdCd: '41290', matchNames: ['과천주공5단지', '주공5단지'] }],
  ['군포시|군포산본9-2', { lawdCd: '41410', matchNames: ['산본주공9단지2차', '주공9단지2차'] }],
  ['군포시|군포산본11', { lawdCd: '41410', matchNames: ['산본주공11단지', '주공11단지'] }],
  ['오산시|오산원동주공아파트재건축정비구역', { lawdCd: '41370', matchNames: ['원동주공'] }]
]);

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

function apiErrorDetail(response, body) {
  const resultCode = tagValue(body, ['resultCode']);
  const resultMessage = tagValue(body, ['resultMsg', 'resultMessage']);
  if (resultCode || resultMessage) return [resultCode, resultMessage].filter(Boolean).join(' · ');
  const plainBody = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plainBody.slice(0, 160) || response.statusText || '응답 내용 없음';
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
    const areaRange = target.areaRangeSqm;
    const matchesArea = !areaRange || (Number.isFinite(areaSqm) && areaSqm >= areaRange.min && areaSqm < areaRange.max);
    if (!contractDate || !Number.isFinite(priceManwon) || !parsedDate || parsedDate < cutoff || !matchesArea) continue;
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
  let decodedKey;
  try {
    decodedKey = decodeURIComponent(serviceKey.trim());
  } catch {
    throw new Error('MOLIT_SERVICE_KEY 형식이 올바르지 않습니다. 일반 인증키(Decoding)를 다시 등록해 주세요.');
  }
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
    const resultCode = tagValue(body, ['resultCode']);
    if (!response.ok) throw new Error('국토교통부 API HTTP ' + response.status + ': ' + apiErrorDetail(response, body));
    if (!['00', '000'].includes(resultCode)) {
      throw new Error('국토교통부 API 오류: ' + apiErrorDetail(response, body));
    }
    return parseTransactions(body, target, cutoff);
  }));
  const records = responses.flat().sort((left, right) => right.contractDate.localeCompare(left.contractDate));
  return {
    status: records.length ? 'ok' : 'empty',
    message: records.length ? '' : '최근 ' + monthCount + '개월 내 ' + (target.areaLabel ? target.areaLabel + ' ' : '') + '신고 거래가 없어요.',
    periodLabel: '최근 ' + monthCount + '개월 계약일 기준' + (target.areaLabel ? ' · ' + target.areaLabel : '') + ' · ' + records.length + '건',
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
    const items = rawItems.map(normalizeListing).filter((item) => item.priceManwon && item.areaSqm >= HOME_APARTMENT.areaRangeSqm.min && item.areaSqm < HOME_APARTMENT.areaRangeSqm.max);
    return { status: items.length ? 'ok' : 'empty', sourceName: process.env.LISTINGS_SOURCE_NAME || '연결된 매물 데이터 제공자', message: items.length ? '' : '전용 59㎡형 매물이 없습니다.', syncedAt: formatKstTimestamp(), items };
  } catch (error) {
    return { status: 'error', sourceName: process.env.LISTINGS_SOURCE_NAME || '연결된 매물 데이터 제공자', message: '현재 매물 정보를 가져오지 못했어요. 다음 동기화 때 다시 시도합니다.', syncedAt: null, items: [] };
  }
}

function marketPriceEok(payload, prefix) {
  const eok = Number(payload[prefix + 'PriceEok']);
  if (Number.isFinite(eok) && eok > 0) return eok;
  const manwon = Number(payload[prefix + 'PriceManwon']);
  if (Number.isFinite(manwon) && manwon > 0) return manwon / 10000;
  const won = Number(payload[prefix + 'PriceWon']);
  return Number.isFinite(won) && won > 0 ? won / 100000000 : Number.NaN;
}

async function fetchKbMarketPrice() {
  const endpoint = process.env.KB_MARKET_API_URL;
  if (!endpoint) {
    return {
      status: 'not_available',
      sourceName: 'KB부동산',
      message: 'KB 시세 공개 API가 없어 현재는 직접 입력합니다.',
      syncedAt: null
    };
  }
  try {
    const headers = { Accept: 'application/json' };
    if (process.env.KB_MARKET_API_TOKEN) headers.Authorization = 'Bearer ' + process.env.KB_MARKET_API_TOKEN;
    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    const market = payload.marketPrice || payload.kbMarketPrice || payload;
    const lowPriceEok = marketPriceEok(market, 'low');
    const highPriceEok = marketPriceEok(market, 'high');
    if (!Number.isFinite(lowPriceEok) || !Number.isFinite(highPriceEok)) throw new Error('상·하한 시세 필드 없음');
    return {
      status: 'ok',
      sourceName: process.env.KB_MARKET_SOURCE_NAME || '계약된 KB 시세 데이터 제공자',
      message: '',
      syncedAt: formatKstTimestamp(),
      lowPriceEok,
      highPriceEok
    };
  } catch (error) {
    return {
      status: 'error',
      sourceName: process.env.KB_MARKET_SOURCE_NAME || '계약된 KB 시세 데이터 제공자',
      message: '연결된 시세 API를 확인해 주세요: ' + error.message,
      syncedAt: null
    };
  }
}

async function readExistingData(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
}

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  cells.push(value.trim());
  return cells;
}

function parseReconstructionCsv(csv) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines.shift() || '');
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  });
}

function withoutCode(value = '') {
  return String(value).trim().replace(/^\d+\)\s*/, '');
}

function remainingEstimateForStage(stage = '') {
  if (/준공|이전고시/.test(stage)) return '사업 완료 또는 입주 단계';
  if (/착공/.test(stage)) return '준공까지 약 2~4년 추정';
  if (/관리처분/.test(stage)) return '준공까지 약 3~6년 추정';
  if (/사업시행/.test(stage)) return '준공까지 약 4~7년 추정';
  if (/조합설립|사업시행자지정/.test(stage)) return '준공까지 약 6~10년 추정';
  if (/추진위/.test(stage)) return '준공까지 약 8~12년 추정';
  if (/정비구역/.test(stage)) return '준공까지 약 9~13년 추정';
  return '사업 단계에 따라 10년 이상 걸릴 수 있음';
}

function stageOrder(stage = '') {
  if (/준공|이전고시/.test(stage)) return 8;
  if (/착공/.test(stage)) return 7;
  if (/관리처분/.test(stage)) return 6;
  if (/사업시행/.test(stage)) return 5;
  if (/조합설립|사업시행자지정/.test(stage)) return 4;
  if (/추진위/.test(stage)) return 3;
  if (/정비구역/.test(stage)) return 2;
  return 1;
}

function officialReconstructionTargets(rows) {
  const targets = rows
    .filter((row) => row['시도'] === '경기도' && SOUTHERN_GYEONGGI_CITIES.has(row['시군구']) && String(row['사업유형']).includes('재건축'))
    .map((row) => {
      const city = String(row['시군구']).trim();
      const zoneName = String(row['구역명칭']).trim();
      const override = PROJECT_TRADE_OVERRIDES.get(city + '|' + zoneName) || {};
      const stage = withoutCode(row['현 사업추진단계']);
      const projectType = withoutCode(row['사업유형']);
      const operator = withoutCode(row['사업시행자']);
      const supplyHouseholds = Number(String(row['공급 예정 세대수']).replace(/[^0-9]/g, '')) || null;
      return {
        id: 'official-' + normalizedName(city + '-' + zoneName),
        name: zoneName,
        officialZoneName: zoneName,
        location: '경기도 ' + city,
        lawdCd: override.lawdCd || null,
        matchNames: override.matchNames || [],
        stage,
        milestone: [projectType, operator].filter(Boolean).join(' · '),
        remainingEstimate: remainingEstimateForStage(stage),
        sourceUrl: RECONSTRUCTION_SOURCE_URL,
        sourceLabel: '국토교통부 공식 데이터',
        projectType,
        supplyHouseholds
      };
    });

  const merged = targets.map((target) => {
    const curated = CURATED_RECONSTRUCTION_TARGETS.find((item) => item.officialZoneName === target.officialZoneName);
    if (!curated) return target;
    return {
      ...target,
      id: curated.id,
      name: curated.name,
      location: curated.location,
      lawdCd: curated.lawdCd,
      matchNames: curated.matchNames
    };
  });
  CURATED_RECONSTRUCTION_TARGETS.forEach((target) => {
    if (!target.officialZoneName || !targets.some((item) => item.officialZoneName === target.officialZoneName)) merged.push(target);
  });
  return merged.sort((left, right) => stageOrder(right.stage) - stageOrder(left.stage) || left.location.localeCompare(right.location, 'ko'));
}

async function fetchReconstructionDataset(serviceKey) {
  try {
    const url = new URL(RECONSTRUCTION_API_URL);
    url.searchParams.set('serviceKey', decodeURIComponent(serviceKey.trim()));
    url.searchParams.set('page', '1');
    url.searchParams.set('perPage', '2000');
    url.searchParams.set('returnType', 'JSON');
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    if (!Array.isArray(payload.data) || !payload.data.length) throw new Error('응답 데이터 없음');
    return { rows: payload.data, transport: 'Open API' };
  } catch (error) {
    console.warn('[reconstruction] Open API 사용 불가, 공식 CSV로 대체: ' + error.message);
    const response = await fetch(RECONSTRUCTION_CSV_URL);
    if (!response.ok) throw new Error('전국 정비사업 공식 CSV HTTP ' + response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { rows: parseReconstructionCsv(new TextDecoder('euc-kr').decode(bytes)), transport: '공식 CSV' };
  }
}

async function syncReconstruction(serviceKey, previous) {
  let dataset;
  try {
    dataset = await fetchReconstructionDataset(serviceKey);
  } catch (error) {
    console.warn('[reconstruction] 전국 정비사업 데이터를 불러오지 못함: ' + error.message);
    return {
      ...previous,
      status: 'error',
      sync: { lastSuccessfulAt: previous.sync?.lastSuccessfulAt || null, message: '전국 정비사업 데이터를 불러오지 못해 기존 목록을 유지합니다.' }
    };
  }

  const targets = officialReconstructionTargets(dataset.rows);
  const items = [];
  for (const target of targets) {
    const previousItem = previous.items?.find((item) => item.id === target.id);
    if (!target.lawdCd || !target.matchNames?.length) {
      items.push({
        ...target,
        priceStatus: 'not_mapped',
        priceMessage: '정비구역과 실거래 단지 자동 매칭 준비 중',
        latestTransaction: previousItem?.latestTransaction || null
      });
      continue;
    }
    try {
      const trades = await fetchTransactions(serviceKey, target, 12);
      items.push({ ...target, priceStatus: trades.status, priceMessage: trades.message, latestTransaction: trades.records[0] || null });
    } catch (error) {
      console.warn('[MOLIT] ' + target.name + ': ' + error.message);
      items.push({ ...target, priceStatus: 'error', priceMessage: '최근 실거래가를 불러오지 못했어요.', latestTransaction: previousItem?.latestTransaction || null });
    }
  }
  const hasError = items.some((item) => item.priceStatus === 'error');
  return {
    status: hasError ? 'partial' : 'ok',
    source: { name: '국토교통부 전국 도시정비사업 통합 데이터', transport: dataset.transport, url: RECONSTRUCTION_SOURCE_URL },
    sync: { lastSuccessfulAt: formatKstTimestamp(), message: hasError ? '사업 목록은 갱신했고 일부 실거래가는 기존 값을 유지합니다.' : '' },
    items
  };
}

async function main() {
  const previousHome = await readExistingData(HOME_DATA_PATH);
  const previousReconstruction = await readExistingData(RECONSTRUCTION_DATA_PATH);
  const serviceKey = process.env.MOLIT_SERVICE_KEY?.trim();
  if (!serviceKey) throw new Error('MOLIT_SERVICE_KEY GitHub Secret이 비어 있습니다. 저장소 Actions Secret을 확인해 주세요.');
  const recentTransactions = await fetchTransactions(serviceKey, HOME_APARTMENT);
  console.log('[MOLIT] ' + HOME_APARTMENT.name + ': 최근 거래 ' + recentTransactions.records.length + '건 동기화');

  const reconstruction = await syncReconstruction(serviceKey, previousReconstruction);
  const currentListings = await fetchCurrentListings();
  const kbMarketPrice = await fetchKbMarketPrice();
  const homeData = {
    apartment: HOME_APARTMENT,
    sync: { schedule: '매일 14:00 KST', lastSuccessfulAt: formatKstTimestamp() },
    recentTransactions,
    currentListings,
    kbMarketPrice
  };
  await mkdir('data', { recursive: true });
  await writeFile(HOME_DATA_PATH, JSON.stringify(homeData, null, 2) + '\n', 'utf8');
  await writeFile(RECONSTRUCTION_DATA_PATH, JSON.stringify(reconstruction, null, 2) + '\n', 'utf8');
}

main().catch((error) => {
  console.error('[sync-home-price] ' + error.message);
  process.exitCode = 1;
});
