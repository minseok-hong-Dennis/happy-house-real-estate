const tabButtons = [...document.querySelectorAll('[role="tab"][data-tab-target]')];
const tabLinks = [...document.querySelectorAll('[data-tab-link]')];
const tabPanels = [...document.querySelectorAll('[data-tab-panel]')];

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

  const creditPayment = monthlyLoanPayment(creditAmountEok * 100000000, creditRate, creditMonths);
  const totalCompanyRate = COMPANY_LOAN.personalRate + COMPANY_LOAN.companyRate;
  const personalGraceInterest = Number.isFinite(companyPrincipal) ? companyPrincipal * (COMPANY_LOAN.personalRate / 100 / 12) : Number.NaN;
  const monthlyCompanySubsidy = Number.isFinite(companyPrincipal) ? companyPrincipal * (COMPANY_LOAN.companyRate / 100 / 12) : Number.NaN;
  const annualSubsidyTax = Number.isFinite(monthlyCompanySubsidy) ? estimatedSubsidyTax(monthlyCompanySubsidy * 12) : Number.NaN;
  const monthlySubsidyTax = Number.isFinite(annualSubsidyTax) ? annualSubsidyTax / 12 : Number.NaN;
  const companyBankPayment = Number.isFinite(companyPrincipal) ? monthlyLoanPayment(companyPrincipal, totalCompanyRate, COMPANY_LOAN.repaymentMonths) : Number.NaN;
  const graceMonthlyCost = Number.isFinite(companyPrincipal) ? personalGraceInterest + monthlySubsidyTax + creditPayment : Number.NaN;
  const repaymentMonthlyCost = Number.isFinite(companyPrincipal) ? companyBankPayment - monthlyCompanySubsidy + monthlySubsidyTax + creditPayment : Number.NaN;

  setText('#sale-net-proceeds', formatWon(saleNetProceeds));
  setText('#sale-net-caption', hasSalePrice ? '매도가 - 5억원 - 매도 복비' : '현재 집 예상 매도가를 입력해 주세요.');
  setText('#current-sale-equity', formatWon(saleEquity));
  setText('#seller-brokerage', formatWon(sellerBrokerage.fee));
  setText('#company-loan-result', formatEok(loan.amountEok));
  setText('#company-loan-limit', formatEok(loan.amountEok));
  setText('#company-loan-caption', loan.kbChecked ? '5억원 · 매매가 70% · KB 시세 70% 반영' : 'KB 시세 조건 확인 전');
  setText('#kb-check-copy', loan.kbChecked ? 'KB 시세 상·하한 평균의 70% 조건까지 반영했습니다.' : 'KB 시세 입력 전에는 매매가 70%와 5억원 한도를 먼저 적용합니다.');
  setText('#credit-monthly-payment', formatWon(creditPayment));
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
  setText('#annual-subsidy-tax', formatWon(annualSubsidyTax));
  setTextAll('[data-home-move-budget]', formatWon(moveBudget));
  setTextAll('[data-home-extra-cost]', formatWon(transactionCosts));
  setTextAll('[data-home-monthly-cost]', formatWon(repaymentMonthlyCost));
  setTextAll('[data-home-budget-caption]', Number.isFinite(moveBudget) ? '매도 순자금 + 사내 대출 + 신용대출' : '현재 집 예상 매도가를 입력해 주세요.');
  setTextAll('[data-home-cost-caption]', Number.isFinite(transactionCosts) ? '취득세 + 매도·매수 복비 상한' : '매도가 입력 후 계산합니다.');
  setTextAll('[data-home-loan-summary]', Number.isFinite(repaymentMonthlyCost) ? '37개월차 · 지원이자 세금 포함' : '사내 대출 실행액을 계산합니다.');
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
    const values = [record.contractDate || '-', formatPriceManwon(Number(record.priceManwon)), record.areaSqm ? Number(record.areaSqm).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '㎡' : '-', record.floor ? record.floor + '층' : '-'];
    values.forEach((value) => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
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
    title.textContent = listingData?.status === 'error' ? '현재 매물 정보를 불러오지 못했어요.' : '현재 매물 데이터 연결 대기';
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
    meta.textContent = [item.areaSqm ? Number(item.areaSqm).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '㎡' : '', item.floor ? item.floor + '층' : ''].filter(Boolean).join(' · ') || '상세 정보 없음';
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
  setText('#price-apartment-name', apartment.name || '힐스테이트 푸르지오 수원');
  setText('#price-address', apartment.address || '경기도 수원시 팔달구 효원로93번길 33');
  setText('#price-sync-state', syncedAt ? '동기화 완료' : '동기화 대기');
  setText('#price-synced-at', syncedAt ? syncedAt + ' 기준' : (trades.message || '공식 데이터 연결 후 갱신됩니다.'));
  syncDot.classList.toggle('is-synced', Boolean(syncedAt));
  syncDot.classList.toggle('is-error', trades.status === 'error');
  setText('#trade-period', trades.periodLabel || '동기화 후 거래 기간을 표시합니다.');
  setText('#trade-count', Number.isFinite(summary.count) ? summary.count.toLocaleString('ko-KR') + '건' : '-');
  setText('#trade-average', formatPriceManwon(Number(summary.averagePriceManwon)));
  setText('#trade-latest', formatPriceManwon(Number(summary.latestPriceManwon)));
  renderTransactionRows(trades.records);
  renderListings(data.currentListings);
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

function renderReconstruction(data) {
  const container = document.querySelector('#reconstruction-list');
  const sync = data.sync || {};
  const syncedAt = sync.lastSuccessfulAt || null;
  const syncDot = document.querySelector('#reconstruction-sync-dot');
  setText('#reconstruction-sync-state', syncedAt ? '동기화 완료' : '동기화 대기');
  setText('#reconstruction-synced-at', syncedAt ? syncedAt + ' 기준' : (sync.message || '국토교통부 API 연결 후 갱신됩니다.'));
  syncDot.classList.toggle('is-synced', Boolean(syncedAt));
  syncDot.classList.toggle('is-error', data.status === 'error');
  container.replaceChildren();
  const items = data.items || [];
  if (!items.length) {
    const card = document.createElement('article');
    card.className = 'listing-empty';
    const title = document.createElement('h3');
    title.textContent = '재건축 정보를 불러오지 못했어요.';
    card.append(title);
    container.append(card);
    return;
  }
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'reconstruction-card';
    const label = document.createElement('span');
    const title = document.createElement('h3');
    const location = document.createElement('p');
    const details = document.createElement('dl');
    const source = document.createElement('a');
    const transaction = item.latestTransaction || null;
    label.className = 'card-label';
    label.textContent = item.stage || '사업 단계 확인 중';
    title.textContent = item.name || '재건축 단지';
    location.className = 'location';
    location.textContent = item.location || '';
    details.append(
      makeDetailRow('최근 실거래가', transaction ? formatPriceManwon(Number(transaction.priceManwon)) + ' · ' + transaction.contractDate : (item.priceMessage || '동기화 대기')),
      makeDetailRow('다음 이정표', item.milestone || '확인 중'),
      makeDetailRow('남은 기간', item.remainingEstimate || '사업 일정 확인 필요')
    );
    source.href = item.sourceUrl || '#';
    source.target = '_blank';
    source.rel = 'noreferrer';
    source.textContent = item.sourceLabel || '진행 정보 출처';
    card.append(label, title, location, details, source);
    container.append(card);
  });
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
  fields.creditTerm.value = '5';
  fields.taxArea.value = '84';
  calculateFinance();
});

calculateFinance();
loadHomePrice();
loadReconstruction();
