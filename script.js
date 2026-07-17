const tabButtons = [...document.querySelectorAll('[role="tab"][data-tab-target]')];
const tabLinks = [...document.querySelectorAll('[data-tab-link]')];
const tabPanels = [...document.querySelectorAll('[data-tab-panel]')];
const RECONSTRUCTION_PAGE_SIZE = 24;
const HOME_MAP_POINT = [37.2669, 127.0158];

let reconstructionItems = [];
let visibleReconstructionCount = RECONSTRUCTION_PAGE_SIZE;
let propertyMap = null;
let reconstructionMapLayer = null;
let homeMapMarker = null;
const reconstructionMarkers = new Map();

const COMPANY_LOAN = {
  capEok: 5,
  personalRate: 1.5,
  companyRate: 3.1,
  graceMonths: 36,
  repaymentMonths: 120,
  annualSalary: 100000000
};
const CURRENT_MORTGAGE = 500000000;

const fields = {
  salePrice: document.querySelector('#current-sale-price'),
  kbLow: document.querySelector('#kb-low-price'),
  kbHigh: document.querySelector('#kb-high-price'),
  creditAmount: document.querySelector('#credit-loan-amount'),
  creditRate: document.querySelector('#credit-loan-rate'),
  creditType: document.querySelector('#credit-loan-type'),
  creditTerm: document.querySelector('#credit-loan-term'),
  taxArea: document.querySelector('#tax-area')
};

function showTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === tabName;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  tabPanels.forEach((panel) => { panel.hidden = panel.dataset.tabPanel !== tabName; });
  window.scrollTo({ top: 0, left: 0 });
  if (tabName === 'map' && propertyMap) {
    window.setTimeout(() => propertyMap.invalidateSize(), 50);
  }
}

tabButtons.forEach((button, index) => {
  button.addEventListener('click', () => showTab(button.dataset.tabTarget));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
    const nextButton = tabButtons[(index + direction + tabButtons.length) % tabButtons.length];
    nextButton.focus();
    showTab(nextButton.dataset.tabTarget);
  });
});

tabLinks.forEach((button) => {
  button.addEventListener('click', () => showTab(button.dataset.tabLink));
});

function numberValue(element) {
  if (!element || element.value.trim() === '') return Number.NaN;
  return Number(element.value);
}

function formatWon(value) {
  if (!Number.isFinite(value)) return '입력 필요';
  return Math.round(value).toLocaleString('ko-KR') + '원';
}

function formatEok(value) {
  if (!Number.isFinite(value)) return '입력 필요';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '억원';
}

function formatPriceManwon(value) {
  if (!Number.isFinite(value)) return '-';
  const eok = Math.floor(value / 10000);
  const remainder = Math.round(value % 10000);
  if (eok === 0) return remainder.toLocaleString('ko-KR') + '만원';
  if (remainder === 0) return eok.toLocaleString('ko-KR') + '억원';
  return eok.toLocaleString('ko-KR') + '억 ' + remainder.toLocaleString('ko-KR') + '만원';
}

function setText(selector, value) {
  const target = document.querySelector(selector);
  if (target) target.textContent = value;
}

function setTextAll(selector, value) {
  document.querySelectorAll(selector).forEach((target) => { target.textContent = value; });
}

function monthlyLoanPayment(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return principal * (monthlyRate * factor) / (factor - 1);
}

function brokerageMaximum(price) {
  if (!Number.isFinite(price) || price <= 0) return { fee: Number.NaN, rate: Number.NaN };
  if (price < 50000000) return { fee: Math.min(price * 0.006, 250000), rate: 0.006 };
  if (price < 200000000) return { fee: Math.min(price * 0.005, 800000), rate: 0.005 };
  if (price < 900000000) return { fee: price * 0.004, rate: 0.004 };
  return { fee: price * 0.009, rate: 0.009 };
}

function earnedIncomeDeduction(grossSalary) {
  if (grossSalary <= 5000000) return grossSalary * 0.7;
  if (grossSalary <= 15000000) return 3500000 + (grossSalary - 5000000) * 0.4;
  if (grossSalary <= 45000000) return 7500000 + (grossSalary - 15000000) * 0.15;
  if (grossSalary <= 100000000) return 12000000 + (grossSalary - 45000000) * 0.05;
  return Math.min(20000000, 14750000 + (grossSalary - 100000000) * 0.02);
}

function progressiveIncomeTax(taxBase) {
  if (taxBase <= 14000000) return taxBase * 0.06;
  if (taxBase <= 50000000) return 840000 + (taxBase - 14000000) * 0.15;
  if (taxBase <= 88000000) return 6240000 + (taxBase - 50000000) * 0.24;
  if (taxBase <= 150000000) return 15360000 + (taxBase - 88000000) * 0.35;
  if (taxBase <= 300000000) return 37060000 + (taxBase - 150000000) * 0.38;
  if (taxBase <= 500000000) return 94060000 + (taxBase - 300000000) * 0.4;
  if (taxBase <= 1000000000) return 174060000 + (taxBase - 500000000) * 0.42;
  return 384060000 + (taxBase - 1000000000) * 0.45;
}

function estimatedEmploymentTax(grossSalary) {
  // Personal deductions are unknown, so the report applies only statutory earned-income deduction.
  const taxBase = Math.max(0, grossSalary - earnedIncomeDeduction(grossSalary));
  const nationalTax = progressiveIncomeTax(taxBase);
  return nationalTax * 1.1;
}

function estimatedSubsidyTax(annualSubsidy) {
  const baseTax = estimatedEmploymentTax(COMPANY_LOAN.annualSalary);
  const supportedTax = estimatedEmploymentTax(COMPANY_LOAN.annualSalary + annualSubsidy);
  return Math.max(0, supportedTax - baseTax);
}

function companyLoanFromReport(baseFundsEok, kbLowEok, kbHighEok) {
  if (!Number.isFinite(baseFundsEok) || baseFundsEok <= 0) return { amountEok: Number.NaN, kbChecked: false };
  const kbChecked = Number.isFinite(kbLowEok) && kbLowEok > 0 && Number.isFinite(kbHighEok) && kbHighEok > 0;
  const kbCapEok = kbChecked ? ((kbLowEok + kbHighEok) / 2) * 0.7 : Number.POSITIVE_INFINITY;
  let amountEok = 0;
  for (let index = 0; index < 40; index += 1) {
    const priceCapEok = (baseFundsEok + amountEok) * 0.7;
    const nextAmount = Math.max(0, Math.min(COMPANY_LOAN.capEok, priceCapEok, kbCapEok));
    if (Math.abs(nextAmount - amountEok) < 0.0001) return { amountEok: nextAmount, kbChecked };
    amountEok = nextAmount;
  }
  return { amountEok, kbChecked };
}

function estimatePurchaseTax(price, area) {
  if (!Number.isFinite(price) || price <= 0) return { total: Number.NaN, acquisitionTax: Number.NaN, localEducationTax: Number.NaN, ruralSpecialTax: Number.NaN };
  let acquisitionRate;
  if (price <= 600000000) acquisitionRate = 0.01;
  else if (price <= 900000000) acquisitionRate = ((price / 100000000) * 2 / 3 - 3) / 100;
  else acquisitionRate = 0.03;
  const acquisitionTax = price * acquisitionRate;
  const localEducationTax = acquisitionTax * 0.1;
  const ruralSpecialTax = Number.isFinite(area) && area > 85 ? price * 0.002 : 0;
  return { total: acquisitionTax + localEducationTax + ruralSpecialTax, acquisitionTax, localEducationTax, ruralSpecialTax };
}

function calculateFinance() {
  const salePriceEok = numberValue(fields.salePrice);
  const creditAmountEok = Math.max(0, numberValue(fields.creditAmount) || 0);
  const creditRate = Math.max(0, numberValue(fields.creditRate) || 0);
  const creditType = fields.creditType.value;
  const creditMonths = Math.max(1, Number(fields.creditTerm.value) || 5) * 12;
  const area = numberValue(fields.taxArea);
  const hasSalePrice = Number.isFinite(salePriceEok) && salePriceEok > 0;
  const salePrice = hasSalePrice ? salePriceEok * 100000000 : Number.NaN;
  const sellerBrokerage = brokerageMaximum(salePrice);
  const saleEquity = hasSalePrice ? salePrice - CURRENT_MORTGAGE : Number.NaN;
  const saleNetProceeds = hasSalePrice ? saleEquity - sellerBrokerage.fee : Number.NaN;
  const baseFundsEok = hasSalePrice ? Math.max(0, saleNetProceeds) / 100000000 + creditAmountEok : Number.NaN;
  const loan = companyLoanFromReport(baseFundsEok, numberValue(fields.kbLow), numberValue(fields.kbHigh));
  const companyPrincipal = Number.isFinite(loan.amountEok) ? loan.amountEok * 100000000 : Number.NaN;
  const moveBudget = Number.isFinite(companyPrincipal) ? saleNetProceeds + companyPrincipal + creditAmountEok * 100000000 : Number.NaN;
  const buyerBrokerage = brokerageMaximum(moveBudget);
  const purchaseTax = estimatePurchaseTax(moveBudget, area);
  const transactionCosts = Number.isFinite(moveBudget) ? sellerBrokerage.fee + buyerBrokerage.fee + purchaseTax.total : Number.NaN;
  const totalRequired = Number.isFinite(moveBudget) ? moveBudget + purchaseTax.total + buyerBrokerage.fee : Number.NaN;

  const creditPrincipal = creditAmountEok * 100000000;
  const creditPayment = creditType === 'bullet'
    ? creditPrincipal * (creditRate / 100 / 12)
    : monthlyLoanPayment(creditPrincipal, creditRate, creditMonths);
  const creditBalloonPayment = creditType === 'bullet' ? creditPrincipal : 0;
  const totalCompanyRate = COMPANY_LOAN.personalRate + COMPANY_LOAN.companyRate;
  const personalGraceInterest = Number.isFinite(companyPrincipal) ? companyPrincipal * (COMPANY_LOAN.personalRate / 100 / 12) : Number.NaN;
  const monthlyCompanySubsidy = Number.isFinite(companyPrincipal) ? companyPrincipal * (COMPANY_LOAN.companyRate / 100 / 12) : Number.NaN;
  const annualSubsidyTax = Number.isFinite(monthlyCompanySubsidy) ? estimatedSubsidyTax(monthlyCompanySubsidy * 12) : Number.NaN;
  const monthlySubsidyTax = Number.isFinite(annualSubsidyTax) ? annualSubsidyTax / 12 : Number.NaN;
  const companyBankPayment = Number.isFinite(companyPrincipal) ? monthlyLoanPayment(companyPrincipal, totalCompanyRate, COMPANY_LOAN.repaymentMonths) : Number.NaN;
  const graceMonthlyCost = Number.isFinite(companyPrincipal) ? personalGraceInterest + monthlySubsidyTax + creditPayment : Number.NaN;
  const companyRepaymentMonthlyCost = Number.isFinite(companyPrincipal) ? companyBankPayment - monthlyCompanySubsidy + monthlySubsidyTax : Number.NaN;
  const creditContinuesAfterGrace = creditPrincipal > 0 && creditMonths > COMPANY_LOAN.graceMonths;
  const repaymentMonthlyCost = Number.isFinite(companyRepaymentMonthlyCost) ? companyRepaymentMonthlyCost + (creditContinuesAfterGrace ? creditPayment : 0) : Number.NaN;

  setText('#sale-net-proceeds', formatWon(saleNetProceeds));
  setText('#sale-net-caption', hasSalePrice ? '매도가 - 5억원 - 매도 복비' : '현재 집 예상 매도가를 입력해 주세요.');
  setText('#current-sale-equity', formatWon(saleEquity));
  setText('#seller-brokerage', formatWon(sellerBrokerage.fee));
  setText('#company-loan-result', formatEok(loan.amountEok));
  setText('#company-loan-limit', formatEok(loan.amountEok));
  setText('#company-loan-caption', loan.kbChecked ? '5억원 · 매매가 70% · KB 시세 70% 반영' : 'KB 시세 조건 확인 전');
  setText('#kb-check-copy', loan.kbChecked ? 'KB 시세 상·하한 평균의 70% 조건까지 반영했습니다.' : 'KB 시세 입력 전에는 매매가 70%와 5억원 한도를 먼저 적용합니다.');
  setText('#credit-monthly-payment', formatWon(creditPayment));
  setText('#credit-balloon-payment', formatWon(creditBalloonPayment));
  setText('#credit-repayment-note', creditType === 'bullet'
    ? creditMonths + '개월 동안 이자만 내고 만기에 원금 ' + formatWon(creditBalloonPayment) + '을 갚습니다.'
    : '원리금균등은 ' + creditMonths + '개월 동안 매월 원금과 이자를 함께 갚습니다.');
  setText('#move-budget', formatWon(moveBudget));
  setText('#acquisition-tax', formatWon(purchaseTax.acquisitionTax));
  setText('#local-education-tax', formatWon(purchaseTax.localEducationTax));
  setText('#rural-special-tax', formatWon(purchaseTax.ruralSpecialTax));
  setText('#tax-total', formatWon(purchaseTax.total));
  setText('#buyer-brokerage', formatWon(buyerBrokerage.fee));
  setText('#total-transaction-cost', formatWon(transactionCosts));
  setText('#total-moving-required', formatWon(totalRequired));
  setText('#grace-monthly-cost', formatWon(graceMonthlyCost));
  setText('#repayment-monthly-cost', formatWon(repaymentMonthlyCost));
  setText('#repayment-period-label', creditContinuesAfterGrace ? '37~' + creditMonths + '개월' : '37개월부터');
  setText('#repayment-period-copy', creditContinuesAfterGrace ? '사내 대출 + 신용대출' : '사내 대출 원리금 상환');
  const postCreditRow = document.querySelector('#post-credit-monthly-row');
  postCreditRow.hidden = !creditContinuesAfterGrace;
  setText('#post-credit-period-label', (creditMonths + 1) + '개월부터');
  setText('#post-credit-monthly-cost', formatWon(companyRepaymentMonthlyCost));
  setText('#annual-subsidy-tax', formatWon(annualSubsidyTax));
  setTextAll('[data-home-move-budget]', formatWon(moveBudget));
  setTextAll('[data-home-extra-cost]', formatWon(transactionCosts));
  setTextAll('[data-home-monthly-cost]', formatWon(repaymentMonthlyCost));
  setTextAll('[data-home-budget-caption]', Number.isFinite(moveBudget) ? '매도 순자금 + 사내 대출 + 신용대출' : '현재 집 예상 매도가를 입력해 주세요.');
  setTextAll('[data-home-cost-caption]', Number.isFinite(transactionCosts) ? '취득세 + 매도·매수 복비 상한' : '매도가 입력 후 계산합니다.');
  setTextAll('[data-home-loan-summary]', Number.isFinite(repaymentMonthlyCost) ? '37개월차 · ' + (creditContinuesAfterGrace ? (creditType === 'bullet' ? '신용대출 이자 포함' : '신용대출 원리금 포함') : '신용대출 종료 후') : '사내 대출 실행액을 계산합니다.');
  setTextAll('[data-home-sale-net]', formatWon(saleNetProceeds));
  setTextAll('[data-home-company-loan]', formatWon(companyPrincipal));
  setTextAll('[data-home-credit-loan]', formatWon(creditAmountEok * 100000000));
  setTextAll('[data-result-sale-net]', formatWon(saleNetProceeds));
  setTextAll('[data-result-credit]', formatWon(creditAmountEok * 100000000));
  setText('#tax-disclaimer', '1주택 일반 매수 기준 추정입니다. 양도소득세, 일시적 2주택·다주택 중과, 대출 부대비용, 법무사비, 이사비는 포함하지 않습니다. 복비는 법정 상한이며 부가세와 실제 협의 금액은 별도입니다.');
}

function renderTransactionRows(records) {
  const tbody = document.querySelector('#recent-trades-body');
  tbody.replaceChildren();
  if (!records?.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'table-empty';
    cell.textContent = '최근 3개월 내 표시할 거래가 없어요.';
    row.append(cell);
    tbody.append(row);
    return;
  }
  records.slice(0, 10).forEach((record) => {
    const row = document.createElement('tr');
    const labels = ['계약일', '거래가', '전용면적', '층'];
    const values = [record.contractDate || '-', formatPriceManwon(Number(record.priceManwon)), record.areaSqm ? Number(record.areaSqm).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '㎡' : '-', record.floor ? record.floor + '층' : '-'];
    values.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.dataset.label = labels[index];
      cell.textContent = value;
      row.append(cell);
    });
    tbody.append(row);
  });
}

function renderListings(listingData) {
  const container = document.querySelector('#current-listings-body');
  const state = document.querySelector('#current-listings-state');
  const sourceName = document.querySelector('#listing-source-name');
  const items = listingData?.items || [];
  container.replaceChildren();
  sourceName.textContent = listingData?.sourceName || '허용된 매물 데이터 제공자 연결 대기';
  if (listingData?.status !== 'ok' || !items.length) {
    const card = document.createElement('article');
    card.className = 'listing-empty';
    const title = document.createElement('h3');
    const description = document.createElement('p');
    title.textContent = listingData?.status === 'error' ? '현재 매물 정보를 불러오지 못했어요.' : (listingData?.status === 'empty' ? '전용 59㎡형 매물이 없어요.' : '현재 매물 데이터 연결 대기');
    description.textContent = listingData?.message || '자동 수집이 허용된 부동산 데이터 API를 연결하면 최신 매물가를 보여드려요.';
    card.append(title, description);
    container.append(card);
    state.textContent = description.textContent;
    return;
  }
  state.textContent = '총 ' + items.length + '건 · ' + (listingData.syncedAt || '최근') + ' 기준';
  items.slice(0, 6).forEach((item) => {
    const card = document.createElement('article');
    card.className = 'listing-card';
    const label = document.createElement('span');
    const title = document.createElement('h3');
    const price = document.createElement('strong');
    const meta = document.createElement('p');
    label.textContent = item.tradeType || '매매';
    title.textContent = item.title || '현재 매물';
    price.textContent = formatPriceManwon(Number(item.priceManwon));
    meta.textContent = [item.areaSqm ? Number(item.areaSqm).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '㎡' : '', item.floor ? item.floor + '층' : ''].filter(Boolean).join(' · ') || '상세 정보 없음';
    card.append(label, title, price, meta);
    container.append(card);
  });
}

function renderHomePrice(data) {
  const apartment = data.apartment || {};
  const sync = data.sync || {};
  const trades = data.recentTransactions || {};
  const summary = trades.summary || {};
  const syncedAt = sync.lastSuccessfulAt || null;
  const syncDot = document.querySelector('#price-sync-dot');
  const areaLabel = apartment.areaLabel || '전용 59㎡형';
  const apartmentLabel = [apartment.name || '힐스테이트 푸르지오 수원', areaLabel].join(' · ');
  setText('#price-apartment-name', apartmentLabel);
  setText('#price-address', apartment.address || '경기도 수원시 팔달구 효원로93번길 33');
  setText('#price-sync-state', syncedAt ? '동기화 완료' : '동기화 대기');
  setText('#price-synced-at', syncedAt ? syncedAt + ' 기준' : (trades.message || '공식 데이터 연결 후 갱신됩니다.'));
  syncDot.classList.toggle('is-synced', Boolean(syncedAt));
  syncDot.classList.toggle('is-error', trades.status === 'error');
  setText('#trade-title', '최근 3개월 ' + areaLabel + ' 실거래가');
  setText('#trade-period', trades.periodLabel || '동기화 후 거래 기간을 표시합니다.');
  setText('#trade-count', Number.isFinite(summary.count) ? summary.count.toLocaleString('ko-KR') + '건' : '-');
  setText('#trade-average', formatPriceManwon(Number(summary.averagePriceManwon)));
  setText('#trade-latest', formatPriceManwon(Number(summary.latestPriceManwon)));
  renderTransactionRows(trades.records);
  renderListings(data.currentListings);

  const kbMarket = data.kbMarketPrice || {};
  if (kbMarket.status === 'ok' && Number.isFinite(kbMarket.lowPriceEok) && Number.isFinite(kbMarket.highPriceEok)) {
    if (!fields.kbLow.value) fields.kbLow.value = kbMarket.lowPriceEok;
    if (!fields.kbHigh.value) fields.kbHigh.value = kbMarket.highPriceEok;
    setText('#kb-sync-copy', (kbMarket.sourceName || '연결된 시세 제공자') + ' · ' + (kbMarket.syncedAt || '동기화 완료'));
    calculateFinance();
  } else {
    setText('#kb-sync-copy', kbMarket.message || 'KB 시세 공개 API가 없어 현재는 직접 입력합니다.');
  }
}

function makeDetailRow(label, value) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  const detail = document.createElement('dd');
  term.textContent = label;
  detail.textContent = value;
  row.append(term, detail);
  return row;
}

const LEGACY_REGION_POINTS = [
  { name: '수원영통구', aliases: ['수원시 영통구', '수원영통구'], point: [37.2596, 127.0464] },
  { name: '성남분당구', aliases: ['성남시 분당구', '성남분당구'], point: [37.3828, 127.1189] },
  { name: '평택시', aliases: ['평택시'], point: [36.9921, 127.1127] },
  { name: '의왕시', aliases: ['의왕시'], point: [37.3449, 126.9683] },
  { name: '과천시', aliases: ['과천시'], point: [37.4292, 126.9876] },
  { name: '군포시', aliases: ['군포시'], point: [37.3617, 126.9352] },
  { name: '오산시', aliases: ['오산시'], point: [37.1498, 127.0772] }
];

function inferredRegion(item) {
  if (item.regionName) return item.regionName;
  return LEGACY_REGION_POINTS.find((region) => region.aliases.some((alias) => (item.location || '').includes(alias)))?.name || '기타 지역';
}

function fallbackMapPoint(item) {
  if (Number.isFinite(item.mapPoint?.latitude) && Number.isFinite(item.mapPoint?.longitude)) return item.mapPoint;
  const region = LEGACY_REGION_POINTS.find((candidate) => candidate.name === inferredRegion(item));
  if (!region) return null;
  const hash = Array.from(item.name || '').reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 17);
  const angle = (hash % 360) * Math.PI / 180;
  const radius = 0.0025 + ((hash >>> 8) % 7) * 0.0012;
  return {
    latitude: region.point[0] + Math.sin(angle) * radius,
    longitude: region.point[1] + Math.cos(angle) * radius,
    accuracy: '시군구 중심 기준 추정 위치'
  };
}

function stageRank(stage = '') {
  if (/준공|이전고시/.test(stage)) return 8;
  if (/착공|이주|철거/.test(stage)) return 7;
  if (/관리처분/.test(stage)) return 6;
  if (/사업시행/.test(stage)) return 5;
  if (/조합설립|사업시행자/.test(stage)) return 4;
  if (/추진위|주민대표/.test(stage)) return 3;
  if (/정비구역/.test(stage)) return 2;
  return 1;
}

function stageGroup(stage = '') {
  if (/준공|착공|관리처분|이주|철거/.test(stage)) return 'late';
  if (/사업시행|조합설립/.test(stage)) return 'middle';
  if (/추진위|정비구역|주민대표/.test(stage)) return 'early';
  return 'other';
}

function googleMapsUrl(item) {
  const query = item.mapQuery || [item.location, item.name].filter(Boolean).join(' ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

function normalizeReconstructionItem(item) {
  return {
    ...item,
    regionName: inferredRegion(item),
    mapPoint: fallbackMapPoint(item)
  };
}

function populateRegionFilters(items) {
  const regions = [...new Set(items.map((item) => item.regionName).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ko'));
  ['#reconstruction-region-filter', '#map-region-filter'].forEach((selector) => {
    const select = document.querySelector(selector);
    const currentValue = select.value;
    select.replaceChildren(new Option('전체 지역', 'all'));
    regions.forEach((region) => select.add(new Option(region, region)));
    select.value = regions.includes(currentValue) ? currentValue : 'all';
  });
}

function filteredReconstructionItems() {
  const search = document.querySelector('#reconstruction-search').value.trim().toLocaleLowerCase('ko');
  const region = document.querySelector('#reconstruction-region-filter').value;
  const stage = document.querySelector('#reconstruction-stage-filter').value;
  const priceOnly = document.querySelector('#reconstruction-price-only').checked;
  const sort = document.querySelector('#reconstruction-sort').value;
  const filtered = reconstructionItems.filter((item) => {
    const haystack = [item.name, item.location, item.regionName].filter(Boolean).join(' ').toLocaleLowerCase('ko');
    return (!search || haystack.includes(search))
      && (region === 'all' || item.regionName === region)
      && (stage === 'all' || stageGroup(item.stage) === stage)
      && (!priceOnly || Boolean(item.latestTransaction));
  });
  return filtered.sort((left, right) => {
    if (sort === 'households') return (right.supplyHouseholds || 0) - (left.supplyHouseholds || 0) || left.name.localeCompare(right.name, 'ko');
    if (sort === 'name') return left.name.localeCompare(right.name, 'ko');
    return stageRank(right.stage) - stageRank(left.stage) || left.location.localeCompare(right.location, 'ko');
  });
}

function makeQuickValue(label, value) {
  const wrapper = document.createElement('span');
  const caption = document.createElement('small');
  const result = document.createElement('b');
  caption.textContent = label;
  result.textContent = value;
  wrapper.append(caption, result);
  return wrapper;
}

function makeReconstructionCard(item) {
  const card = document.createElement('article');
  const label = document.createElement('span');
  const title = document.createElement('h3');
  const location = document.createElement('p');
  const quickValues = document.createElement('div');
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const detailList = document.createElement('dl');
  const footer = document.createElement('div');
  const source = document.createElement('a');
  const mapButton = document.createElement('button');
  const transaction = item.latestTransaction || null;
  card.className = 'reconstruction-card';
  label.className = 'card-label';
  label.textContent = item.stage || '사업 단계 확인 중';
  title.textContent = item.name || '재건축 단지';
  location.className = 'location';
  location.textContent = item.location || '';
  quickValues.className = 'reconstruction-quick-values';
  quickValues.append(
    makeQuickValue('최근 실거래', transaction ? formatPriceManwon(Number(transaction.priceManwon)) : '매칭 준비 중'),
    makeQuickValue('예정 세대수', Number.isFinite(item.supplyHouseholds) && item.supplyHouseholds > 0 ? item.supplyHouseholds.toLocaleString('ko-KR') + '세대' : '확인 필요')
  );
  details.className = 'reconstruction-details';
  summary.textContent = '사업 정보';
  detailList.append(
    makeDetailRow('사업 유형', item.projectType || '재건축'),
    makeDetailRow('다음 이정표', item.milestone || '확인 중'),
    makeDetailRow('남은 기간', item.remainingEstimate || '사업 일정 확인 필요')
  );
  details.append(summary, detailList);
  footer.className = 'reconstruction-card-actions';
  source.href = item.sourceUrl || '#';
  source.target = '_blank';
  source.rel = 'noreferrer';
  source.textContent = item.sourceLabel || '공식 출처';
  mapButton.type = 'button';
  mapButton.dataset.mapProject = item.id;
  mapButton.textContent = '지도에서 보기';
  footer.append(source, mapButton);
  card.append(label, title, location, quickValues, details, footer);
  return card;
}

function renderFilteredReconstruction({ resetPage = false } = {}) {
  const container = document.querySelector('#reconstruction-list');
  const loadMore = document.querySelector('#reconstruction-load-more');
  if (resetPage) visibleReconstructionCount = RECONSTRUCTION_PAGE_SIZE;
  const filtered = filteredReconstructionItems();
  const visibleItems = filtered.slice(0, visibleReconstructionCount);
  container.replaceChildren();
  setText('#reconstruction-filtered-count', '검색 결과 ' + filtered.length.toLocaleString('ko-KR') + '개 · ' + visibleItems.length.toLocaleString('ko-KR') + '개 표시');
  if (!visibleItems.length) {
    const card = document.createElement('article');
    const title = document.createElement('h3');
    const copy = document.createElement('p');
    card.className = 'listing-empty';
    title.textContent = '조건에 맞는 사업이 없어요.';
    copy.textContent = '검색어나 필터를 바꿔 다시 확인해 주세요.';
    card.append(title, copy);
    container.append(card);
  } else {
    visibleItems.forEach((item) => container.append(makeReconstructionCard(item)));
  }
  loadMore.hidden = visibleItems.length >= filtered.length;
  loadMore.textContent = '더 보기 (' + (filtered.length - visibleItems.length).toLocaleString('ko-KR') + '개 남음)';
}

function mapPopupContent(item) {
  const wrapper = document.createElement('div');
  const stage = document.createElement('span');
  const title = document.createElement('b');
  const location = document.createElement('small');
  const link = document.createElement('a');
  wrapper.className = 'map-popup';
  stage.textContent = item.stage || '진행 단계 확인 중';
  title.textContent = item.name || '재건축 사업';
  location.textContent = item.location || '';
  link.href = googleMapsUrl(item);
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = 'Google Maps에서 확인';
  wrapper.append(stage, title, location, link);
  return wrapper;
}

function initializePropertyMap() {
  if (propertyMap || !window.L) return;
  propertyMap = window.L.map('property-map', { scrollWheelZoom: false, zoomControl: true }).setView([37.32, 127.01], 10);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(propertyMap);
  reconstructionMapLayer = window.L.layerGroup().addTo(propertyMap);
  const homeIcon = window.L.divIcon({ className: 'home-map-marker', html: '<span aria-hidden="true">🏠</span>', iconSize: [36, 36], iconAnchor: [18, 31] });
  homeMapMarker = window.L.marker(HOME_MAP_POINT, { icon: homeIcon, title: '힐스테이트 푸르지오 수원' }).addTo(propertyMap);
  const homePopup = document.createElement('div');
  const homeTitle = document.createElement('b');
  const homeCopy = document.createElement('small');
  const homeLink = document.createElement('a');
  homePopup.className = 'map-popup';
  homeTitle.textContent = '힐스테이트 푸르지오 수원';
  homeCopy.textContent = '현재 우리집 · 전용 59㎡형';
  homeLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('힐스테이트 푸르지오 수원');
  homeLink.target = '_blank';
  homeLink.rel = 'noreferrer';
  homeLink.textContent = 'Google Maps에서 확인';
  homePopup.append(homeTitle, homeCopy, homeLink);
  homeMapMarker.bindPopup(homePopup);
}

function focusMapProject(item) {
  showTab('map');
  document.querySelector('#map-region-filter').value = 'all';
  renderMapProjects();
  const marker = reconstructionMarkers.get(item.id);
  if (marker && propertyMap) {
    propertyMap.setView(marker.getLatLng(), 14, { animate: true });
    marker.openPopup();
  }
  const googleLink = document.querySelector('#selected-google-map-link');
  googleLink.href = googleMapsUrl(item);
  googleLink.textContent = item.name + ' · Google Maps';
}

function renderMapProjects() {
  initializePropertyMap();
  const list = document.querySelector('#map-project-list');
  const region = document.querySelector('#map-region-filter').value;
  const items = reconstructionItems.filter((item) => (region === 'all' || item.regionName === region) && item.mapPoint);
  list.replaceChildren();
  if (!propertyMap || !reconstructionMapLayer) {
    const copy = document.createElement('p');
    copy.textContent = '지도를 불러오지 못했어요. Google Maps 버튼을 이용해 주세요.';
    list.append(copy);
    return;
  }
  reconstructionMapLayer.clearLayers();
  reconstructionMarkers.clear();
  const bounds = window.L.latLngBounds([HOME_MAP_POINT]);
  items.forEach((item) => {
    const point = [item.mapPoint.latitude, item.mapPoint.longitude];
    const marker = window.L.circleMarker(point, { radius: 7, color: '#ffffff', weight: 2, fillColor: '#ff6659', fillOpacity: 0.95 });
    marker.bindPopup(mapPopupContent(item));
    marker.addTo(reconstructionMapLayer);
    reconstructionMarkers.set(item.id, marker);
    bounds.extend(point);
    const button = document.createElement('button');
    const name = document.createElement('b');
    const meta = document.createElement('small');
    button.type = 'button';
    button.dataset.mapProject = item.id;
    name.textContent = item.name;
    meta.textContent = [item.regionName, item.stage].filter(Boolean).join(' · ');
    button.append(name, meta);
    list.append(button);
  });
  setText('#map-pin-count', '우리집 1개 · 재건축 ' + items.length.toLocaleString('ko-KR') + '개 핀');
  if (items.length) propertyMap.fitBounds(bounds, { padding: [28, 28], maxZoom: region === 'all' ? 10 : 12 });
}

function renderReconstruction(data) {
  const sync = data.sync || {};
  const syncedAt = sync.lastSuccessfulAt || null;
  const syncDot = document.querySelector('#reconstruction-sync-dot');
  setText('#reconstruction-sync-state', syncedAt ? '동기화 완료' : '동기화 대기');
  setText('#reconstruction-synced-at', syncedAt ? syncedAt + ' 기준' : (sync.message || '국토교통부 API 연결 후 갱신됩니다.'));
  syncDot.classList.toggle('is-synced', Boolean(syncedAt));
  syncDot.classList.toggle('is-error', data.status === 'error');
  reconstructionItems = (data.items || []).map(normalizeReconstructionItem);
  const countLabel = reconstructionItems.length ? reconstructionItems.length.toLocaleString('ko-KR') + '개 진행 사업' : '진행 사업';
  setText('#reconstruction-count', countLabel);
  setText('#reconstruction-shortcut-count', reconstructionItems.length ? '경기 남부 ' + reconstructionItems.length.toLocaleString('ko-KR') + '개 사업' : '공식 사업 목록 확인');
  populateRegionFilters(reconstructionItems);
  renderFilteredReconstruction({ resetPage: true });
  renderMapProjects();
}

async function loadHomePrice() {
  try {
    const response = await fetch('data/home-price.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('가격 데이터 파일을 찾을 수 없습니다.');
    renderHomePrice(await response.json());
  } catch (error) {
    renderHomePrice({ recentTransactions: { status: 'error', message: '가격 정보를 불러오지 못했어요. 다음 동기화 때 다시 시도합니다.' }, currentListings: { status: 'error', message: '현재 매물 정보를 불러오지 못했어요.' } });
  }
}

async function loadReconstruction() {
  try {
    const response = await fetch('data/reconstruction.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('재건축 데이터 파일을 찾을 수 없습니다.');
    renderReconstruction(await response.json());
  } catch (error) {
    renderReconstruction({ status: 'error', sync: { message: '재건축 정보를 불러오지 못했어요.' }, items: [] });
  }
}

Object.values(fields).forEach((field) => {
  field.addEventListener('input', calculateFinance);
  field.addEventListener('change', calculateFinance);
});
document.querySelector('#finance-reset').addEventListener('click', () => {
  fields.salePrice.value = '';
  fields.kbLow.value = '';
  fields.kbHigh.value = '';
  fields.creditAmount.value = '0';
  fields.creditRate.value = '5';
  fields.creditType.value = 'amortizing';
  fields.creditTerm.value = '5';
  fields.taxArea.value = '84';
  calculateFinance();
});

['#reconstruction-search', '#reconstruction-region-filter', '#reconstruction-stage-filter', '#reconstruction-sort', '#reconstruction-price-only'].forEach((selector) => {
  const element = document.querySelector(selector);
  element.addEventListener(element.type === 'search' ? 'input' : 'change', () => renderFilteredReconstruction({ resetPage: true }));
});

document.querySelector('#reconstruction-filter-reset').addEventListener('click', () => {
  document.querySelector('#reconstruction-search').value = '';
  document.querySelector('#reconstruction-region-filter').value = 'all';
  document.querySelector('#reconstruction-stage-filter').value = 'all';
  document.querySelector('#reconstruction-sort').value = 'progress';
  document.querySelector('#reconstruction-price-only').checked = false;
  renderFilteredReconstruction({ resetPage: true });
});

document.querySelector('#reconstruction-load-more').addEventListener('click', () => {
  visibleReconstructionCount += RECONSTRUCTION_PAGE_SIZE;
  renderFilteredReconstruction();
});

document.querySelector('#map-region-filter').addEventListener('change', renderMapProjects);

document.addEventListener('click', (event) => {
  const mapButton = event.target.closest('[data-map-project]');
  if (!mapButton) return;
  const item = reconstructionItems.find((project) => project.id === mapButton.dataset.mapProject);
  if (item) focusMapProject(item);
});

calculateFinance();
loadHomePrice();
loadReconstruction();
