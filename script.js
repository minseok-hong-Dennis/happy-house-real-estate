const tabButtons = [...document.querySelectorAll('[role="tab"][data-tab-target]')];
const tabLinks = [...document.querySelectorAll('[data-tab-link]')];
const tabPanels = [...document.querySelectorAll('[data-tab-panel]')];
const RECONSTRUCTION_PAGE_SIZE = 24;
const HOME_MAP_POINT = [37.2669, 127.0158];

let reconstructionItems = [];
let visibleReconstructionCount = RECONSTRUCTION_PAGE_SIZE;
let candidateData = null;
let movingBudgetWon = Number.NaN;
let propertyMap = null;
let reconstructionMapLayer = null;
let homeMapMarker = null;
let latestHomePriceManwon = Number.NaN;
let latestHomePriceContractDate = '';
let salePriceTouched = false;
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
const DEFAULT_KB_MARKET = {
  lowEok: 9.1,
  highEok: 10.7,
  apartment: '매교역푸르지오SK뷰 전용 84.97㎡',
  asOf: '2026.07.17',
  sourceUrl: 'https://kbland.kr/se/c/48414'
};
const activeKbMarket = {
  lowEok: DEFAULT_KB_MARKET.lowEok,
  highEok: DEFAULT_KB_MARKET.highEok
};

const fields = {
  salePrice: document.querySelector('#current-sale-price'),
  kbLow: document.querySelector('#kb-low-price'),
  kbHigh: document.querySelector('#kb-high-price'),
  creditAmount: document.querySelector('#credit-loan-amount'),
  creditRate: document.querySelector('#credit-loan-rate'),
  creditInterestOnly: document.querySelector('#credit-interest-only'),
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

function loanPaymentParts(principal, annualRate, months, paymentNumber) {
  if (principal <= 0 || months <= 0 || paymentNumber < 1 || paymentNumber > months) return { payment: 0, principal: 0, interest: 0 };
  const payment = monthlyLoanPayment(principal, annualRate, months);
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return { payment, principal: payment, interest: 0 };
  const elapsed = paymentNumber - 1;
  const growth = Math.pow(1 + monthlyRate, elapsed);
  const balance = Math.max(0, principal * growth - payment * ((growth - 1) / monthlyRate));
  const interest = balance * monthlyRate;
  const principalPayment = Math.min(balance, Math.max(0, payment - interest));
  return { payment: principalPayment + interest, principal: principalPayment, interest };
}

function creditPaymentParts(principal, annualRate, months, repaymentType, paymentNumber) {
  if (principal <= 0 || paymentNumber < 1 || paymentNumber > months) return { payment: 0, principal: 0, interest: 0 };
  if (repaymentType === 'bullet') {
    const interest = principal * (annualRate / 100 / 12);
    return { payment: interest, principal: 0, interest };
  }
  return loanPaymentParts(principal, annualRate, months, paymentNumber);
}

function companyRepaymentParts(principal, paymentNumber) {
  const totalRate = COMPANY_LOAN.personalRate + COMPANY_LOAN.companyRate;
  const bankParts = loanPaymentParts(principal, totalRate, COMPANY_LOAN.repaymentMonths, paymentNumber);
  const subsidyInterest = totalRate > 0 ? bankParts.interest * (COMPANY_LOAN.companyRate / totalRate) : 0;
  const personalInterest = Math.max(0, bankParts.interest - subsidyInterest);
  const subsidyTax = estimatedSubsidyTax(subsidyInterest * 12) / 12;
  return {
    total: bankParts.principal + personalInterest + subsidyTax,
    principal: bankParts.principal,
    personalInterest,
    subsidyTax
  };
}

function setMonthlyBreakdown(prefix, values) {
  setText('#' + prefix + '-company-principal', formatWon(values.companyPrincipal));
  setText('#' + prefix + '-company-interest', formatWon(values.companyInterest));
  setText('#' + prefix + '-credit-principal', formatWon(values.creditPrincipal));
  setText('#' + prefix + '-credit-interest', formatWon(values.creditInterest));
  setText('#' + prefix + '-subsidy-tax', formatWon(values.subsidyTax));
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
  const creditType = fields.creditInterestOnly.checked ? 'bullet' : 'amortizing';
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
  movingBudgetWon = moveBudget;
  const buyerBrokerage = brokerageMaximum(moveBudget);
  const purchaseTax = estimatePurchaseTax(moveBudget, area);
  const transactionCosts = Number.isFinite(moveBudget) ? sellerBrokerage.fee + buyerBrokerage.fee + purchaseTax.total : Number.NaN;
  const totalRequired = Number.isFinite(moveBudget) ? moveBudget + purchaseTax.total + buyerBrokerage.fee : Number.NaN;

  const creditPrincipal = creditAmountEok * 100000000;
  const creditFirstParts = creditPaymentParts(creditPrincipal, creditRate, creditMonths, creditType, 1);
  const creditRepaymentParts = creditPaymentParts(creditPrincipal, creditRate, creditMonths, creditType, COMPANY_LOAN.graceMonths + 1);
  const creditPayment = creditFirstParts.payment;
  const creditBalloonPayment = creditType === 'bullet' ? creditPrincipal : 0;
  const personalGraceInterest = Number.isFinite(companyPrincipal) ? companyPrincipal * (COMPANY_LOAN.personalRate / 100 / 12) : Number.NaN;
  const monthlyCompanySubsidy = Number.isFinite(companyPrincipal) ? companyPrincipal * (COMPANY_LOAN.companyRate / 100 / 12) : Number.NaN;
  const annualSubsidyTax = Number.isFinite(monthlyCompanySubsidy) ? estimatedSubsidyTax(monthlyCompanySubsidy * 12) : Number.NaN;
  const monthlySubsidyTax = Number.isFinite(annualSubsidyTax) ? annualSubsidyTax / 12 : Number.NaN;
  const graceMonthlyCost = Number.isFinite(companyPrincipal) ? personalGraceInterest + monthlySubsidyTax + creditPayment : Number.NaN;
  const firstCompanyRepayment = Number.isFinite(companyPrincipal) ? companyRepaymentParts(companyPrincipal, 1) : null;
  const creditContinuesAfterGrace = creditPrincipal > 0 && creditMonths > COMPANY_LOAN.graceMonths;
  const repaymentMonthlyCost = firstCompanyRepayment ? firstCompanyRepayment.total + creditRepaymentParts.payment : Number.NaN;
  const postCreditMonth = creditMonths + 1;
  const postCreditCompanyPaymentNumber = Math.max(1, postCreditMonth - COMPANY_LOAN.graceMonths);
  const postCreditCompanyParts = Number.isFinite(companyPrincipal) ? companyRepaymentParts(companyPrincipal, postCreditCompanyPaymentNumber) : null;
  const companyRepaymentMonthlyCost = postCreditCompanyParts?.total ?? Number.NaN;

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
  setText('#repayment-period-copy', (creditContinuesAfterGrace ? '사내 대출 + 신용대출' : '사내 대출 원리금 상환') + ' · 37개월차 기준');
  const postCreditRow = document.querySelector('#post-credit-monthly-row');
  postCreditRow.hidden = !creditContinuesAfterGrace;
  setText('#post-credit-period-label', (creditMonths + 1) + '개월부터');
  setText('#post-credit-period-copy', '사내 대출만 반영 · ' + (creditMonths + 1) + '개월차 기준');
  setText('#post-credit-monthly-cost', formatWon(companyRepaymentMonthlyCost));
  setText('#annual-subsidy-tax', formatWon(annualSubsidyTax));
  setMonthlyBreakdown('grace', {
    companyPrincipal: Number.isFinite(companyPrincipal) ? 0 : Number.NaN,
    companyInterest: personalGraceInterest,
    creditPrincipal: creditFirstParts.principal,
    creditInterest: creditFirstParts.interest,
    subsidyTax: monthlySubsidyTax
  });
  setMonthlyBreakdown('repayment', {
    companyPrincipal: firstCompanyRepayment?.principal ?? Number.NaN,
    companyInterest: firstCompanyRepayment?.personalInterest ?? Number.NaN,
    creditPrincipal: creditRepaymentParts.principal,
    creditInterest: creditRepaymentParts.interest,
    subsidyTax: firstCompanyRepayment?.subsidyTax ?? Number.NaN
  });
  setMonthlyBreakdown('post-credit', {
    companyPrincipal: postCreditCompanyParts?.principal ?? Number.NaN,
    companyInterest: postCreditCompanyParts?.personalInterest ?? Number.NaN,
    creditPrincipal: 0,
    creditInterest: 0,
    subsidyTax: postCreditCompanyParts?.subsidyTax ?? Number.NaN
  });
  setTextAll('[data-home-move-budget]', formatWon(moveBudget));
  setTextAll('[data-home-extra-cost]', formatWon(transactionCosts));
  setTextAll('[data-home-monthly-cost]', formatWon(repaymentMonthlyCost));
  setTextAll('[data-home-budget-caption]', Number.isFinite(moveBudget) ? '매도 순자금 + 사내 대출 + 신용대출' : '현재 집 예상 매도가를 입력해 주세요.');
  setTextAll('[data-home-cost-caption]', Number.isFinite(transactionCosts) ? '취득세 + 매도·매수 복비 상한' : '매도가 입력 후 계산합니다.');
  setTextAll('[data-home-loan-summary]', Number.isFinite(repaymentMonthlyCost)
    ? '37개월차 · ' + (creditContinuesAfterGrace ? (creditType === 'bullet' ? '신용대출 이자 포함' : '신용대출 원리금 포함') : (creditPrincipal > 0 ? '신용대출 종료 후' : '사내 대출 원리금'))
    : '사내 대출 실행액을 계산합니다.');
  setTextAll('[data-home-sale-net]', formatWon(saleNetProceeds));
  setTextAll('[data-home-company-loan]', formatWon(companyPrincipal));
  setTextAll('[data-home-credit-loan]', formatWon(creditAmountEok * 100000000));
  setTextAll('[data-candidate-budget]', formatWon(moveBudget));
  setTextAll('[data-result-sale-net]', formatWon(saleNetProceeds));
  setTextAll('[data-result-credit]', formatWon(creditAmountEok * 100000000));
  setText('#tax-disclaimer', '1주택 일반 매수 기준 추정입니다. 양도소득세, 일시적 2주택·다주택 중과, 대출 부대비용, 법무사비, 이사비는 포함하지 않습니다. 복비는 법정 상한이며 부가세와 실제 협의 금액은 별도입니다.');
  if (candidateData) renderCandidates(candidateData);
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
  if (!['ok', 'stale'].includes(listingData?.status) || !items.length) {
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
  state.textContent = '총 ' + items.length + '건 · ' + (listingData.syncedAt || '최근') + ' 기준' + (listingData.status === 'stale' ? ' · 이전 정상값' : '');
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

  latestHomePriceManwon = Number(summary.latestPriceManwon);
  latestHomePriceContractDate = trades.records?.[0]?.contractDate || '';
  if (Number.isFinite(latestHomePriceManwon) && latestHomePriceManwon > 0) {
    if (!salePriceTouched && !fields.salePrice.value) {
      fields.salePrice.value = String(Number((latestHomePriceManwon / 10000).toFixed(4)));
    }
    setText('#current-sale-reference', '최근 실거래 ' + formatPriceManwon(latestHomePriceManwon) + (latestHomePriceContractDate ? ' · ' + latestHomePriceContractDate : '') + (salePriceTouched ? ' 참고 · 직접 입력값 사용 중' : ' 기준 자동 입력'));
  } else {
    setText('#current-sale-reference', '최근 실거래가 확인 전에는 직접 입력해 주세요.');
  }

  const kbMarket = data.kbMarketPrice || {};
  const kbSyncCopy = document.querySelector('#kb-sync-copy');
  if (['ok', 'stale'].includes(kbMarket.status) && Number.isFinite(kbMarket.lowPriceEok) && Number.isFinite(kbMarket.highPriceEok)) {
    activeKbMarket.lowEok = kbMarket.lowPriceEok;
    activeKbMarket.highEok = kbMarket.highPriceEok;
    fields.kbLow.value = kbMarket.lowPriceEok;
    fields.kbHigh.value = kbMarket.highPriceEok;
    setText('#kb-sync-copy', (kbMarket.sourceName || '연결된 시세 제공자') + ' · ' + (kbMarket.syncedAt || '동기화 완료') + (kbMarket.status === 'stale' ? ' · 이전 정상값' : ''));
    if (kbMarket.sourceUrl) kbSyncCopy.href = kbMarket.sourceUrl;
    else kbSyncCopy.removeAttribute('href');
  } else {
    setText('#kb-sync-copy', DEFAULT_KB_MARKET.apartment + ' · ' + DEFAULT_KB_MARKET.asOf + ' KB부동산 기준');
    kbSyncCopy.href = DEFAULT_KB_MARKET.sourceUrl;
  }
  calculateFinance();
}

function budgetFitForPrice(priceManwon) {
  if (!Number.isFinite(movingBudgetWon) || !Number.isFinite(priceManwon)) {
    return { score: 18, label: '예산 입력 전', tone: 'neutral' };
  }
  const ratio = movingBudgetWon / (priceManwon * 10000);
  if (ratio >= 1.15) return { score: 35, label: '예산 여유', tone: 'good' };
  if (ratio >= 1.05) return { score: 32, label: '안정적', tone: 'good' };
  if (ratio >= 1) return { score: 28, label: '예산 안', tone: 'good' };
  if (ratio >= 0.95) return { score: 22, label: '조정 필요', tone: 'watch' };
  if (ratio >= 0.9) return { score: 15, label: '예산 근접', tone: 'watch' };
  return { score: 5, label: '예산 초과', tone: 'over' };
}

function representativeCandidatePrice(areaPrices = []) {
  const prices = areaPrices.map((area) => Number(area.latestPriceManwon)).filter(Number.isFinite).sort((left, right) => left - right);
  if (!prices.length) return Number.NaN;
  if (!Number.isFinite(movingBudgetWon)) return prices[Math.floor(prices.length / 2)];
  const affordable = prices.filter((price) => price * 10000 <= movingBudgetWon);
  return affordable.at(-1) || prices[0];
}

function makeScoreRow(label, value, maximum) {
  const row = document.createElement('div');
  const heading = document.createElement('span');
  const meter = document.createElement('i');
  const fill = document.createElement('b');
  const score = document.createElement('strong');
  heading.textContent = label;
  fill.style.width = Math.min(100, value / maximum * 100) + '%';
  score.textContent = value + '/' + maximum;
  meter.append(fill);
  row.append(heading, meter, score);
  return row;
}

function makeAreaPriceCard(area, expectedType) {
  const card = document.createElement('article');
  const heading = document.createElement('div');
  const label = document.createElement('b');
  const count = document.createElement('small');
  const price = document.createElement('strong');
  const meta = document.createElement('p');
  card.className = 'area-price-card';
  if (!area) {
    label.textContent = '전용 ' + expectedType + '㎡';
    count.textContent = '최근 12개월';
    price.textContent = '신고 거래 없음';
    meta.textContent = '다음 일일 동기화에서 다시 확인합니다.';
    card.classList.add('is-empty');
  } else {
    label.textContent = area.areaLabel || '전용 ' + area.areaTypeSqm + '㎡';
    count.textContent = Number(area.count || 0).toLocaleString('ko-KR') + '건';
    price.textContent = formatPriceManwon(Number(area.latestPriceManwon));
    meta.textContent = (area.latestContractDate || '최근 거래') + ' · 12개월 평균 ' + formatPriceManwon(Number(area.averagePriceManwon)) + ' · 범위 ' + formatPriceManwon(Number(area.minPriceManwon)) + '~' + formatPriceManwon(Number(area.maxPriceManwon));
  }
  heading.append(label, count);
  card.append(heading, price, meta);
  return card;
}

function makeCandidateCard(item) {
  const card = document.createElement('article');
  const heading = document.createElement('div');
  const titleWrap = document.createElement('div');
  const title = document.createElement('h2');
  const meta = document.createElement('p');
  const scoreBadge = document.createElement('div');
  const scoreValue = document.createElement('strong');
  const scoreLabel = document.createElement('small');
  const scoreGrid = document.createElement('div');
  const prices = document.createElement('div');
  const notes = document.createElement('div');
  const strengths = document.createElement('div');
  const watch = document.createElement('p');
  const profile = item.evaluation || {};
  const budgetFit = budgetFitForPrice(representativeCandidatePrice(item.areaPrices));
  const totalScore = budgetFit.score + (profile.transit || 0) + (profile.living || 0) + (profile.complex || 0);

  card.className = 'candidate-card';
  heading.className = 'candidate-card-heading';
  title.textContent = item.displayName || item.name;
  meta.textContent = [item.location, item.completionYear ? item.completionYear + '년 준공' : '', item.households ? item.households.toLocaleString('ko-KR') + '세대' : ''].filter(Boolean).join(' · ');
  titleWrap.append(title, meta);
  scoreBadge.className = 'candidate-score is-' + budgetFit.tone;
  scoreValue.textContent = totalScore + '점';
  scoreLabel.textContent = budgetFit.label;
  scoreBadge.append(scoreValue, scoreLabel);
  heading.append(titleWrap, scoreBadge);

  scoreGrid.className = 'score-grid';
  scoreGrid.append(
    makeScoreRow('예산', budgetFit.score, 35),
    makeScoreRow('교통', profile.transit || 0, 25),
    makeScoreRow('생활', profile.living || 0, 20),
    makeScoreRow('단지', profile.complex || 0, 20)
  );

  prices.className = 'area-price-list';
  const requestedTypes = item.requestedAreaTypes || [];
  if (requestedTypes.length) {
    requestedTypes.forEach((type) => prices.append(makeAreaPriceCard(item.areaPrices?.find((area) => area.areaTypeSqm === type), type)));
  } else if (item.areaPrices?.length) {
    item.areaPrices.forEach((area) => prices.append(makeAreaPriceCard(area)));
  } else {
    prices.append(makeAreaPriceCard(null, '전체'));
  }

  notes.className = 'candidate-notes';
  strengths.className = 'candidate-tags';
  (profile.strengths || []).forEach((text) => {
    const tag = document.createElement('span');
    tag.textContent = text;
    strengths.append(tag);
  });
  watch.textContent = '확인할 점 · ' + (profile.watchouts || ['현장 확인 필요']).join(' · ');
  notes.append(strengths, watch);
  card.append(heading, scoreGrid, prices, notes);
  return card;
}

function recommendationOptions(items) {
  if (!Number.isFinite(movingBudgetWon)) return [];
  return items.map((item) => {
    const affordable = (item.areaPrices || [])
      .filter((area) => Number(area.latestPriceManwon) * 10000 <= movingBudgetWon)
      .sort((left, right) => Number(right.latestPriceManwon) - Number(left.latestPriceManwon));
    return affordable.length ? { item, area: affordable[0] } : null;
  }).filter(Boolean).sort((left, right) => Number(right.area.latestPriceManwon) - Number(left.area.latestPriceManwon)).slice(0, 6);
}

function renderRecommendations(items) {
  const container = document.querySelector('#recommendation-list');
  const options = recommendationOptions(items || []);
  container.replaceChildren();
  if (!Number.isFinite(movingBudgetWon)) {
    const empty = document.createElement('article');
    empty.className = 'listing-empty';
    empty.innerHTML = '<h3>예산 설정이 필요해요.</h3><p>대출 관리에서 현재 집 예상 매도가를 입력하면 추천을 시작합니다.</p>';
    container.append(empty);
    setText('#recommendation-state', '가장 최근 실거래가가 이사 예산 안에 있는 단지를 찾습니다.');
    setText('#recommendation-count', '예산 입력 전');
    return;
  }
  setText('#recommendation-count', options.length + '개 추천');
  setText('#recommendation-state', '가장 최근 실거래가가 ' + formatWon(movingBudgetWon) + ' 이하인 면적 기준');
  if (!options.length) {
    const empty = document.createElement('article');
    empty.className = 'listing-empty';
    empty.innerHTML = '<h3>현재 예산 안의 거래를 찾지 못했어요.</h3><p>신용대출 조건을 조정하거나 다음 동기화 후 다시 확인해 주세요.</p>';
    container.append(empty);
    return;
  }
  options.forEach(({ item, area }) => {
    const card = document.createElement('article');
    const label = document.createElement('span');
    const title = document.createElement('h3');
    const price = document.createElement('strong');
    const meta = document.createElement('p');
    const remainder = document.createElement('small');
    card.className = 'recommendation-card';
    label.textContent = area.areaLabel;
    title.textContent = item.name;
    price.textContent = formatPriceManwon(Number(area.latestPriceManwon));
    meta.textContent = [item.location, area.count + '건', area.latestContractDate + ' 최근 거래'].join(' · ');
    remainder.textContent = '예산 여유 ' + formatWon(movingBudgetWon - Number(area.latestPriceManwon) * 10000);
    card.append(label, title, price, meta, remainder);
    container.append(card);
  });
}

function renderCandidates(data) {
  candidateData = data;
  const sync = data.sync || {};
  const syncedAt = sync.lastSuccessfulAt || null;
  const syncDot = document.querySelector('#candidate-sync-dot');
  setText('#candidate-sync-state', syncedAt ? '동기화 완료' : '동기화 대기');
  setText('#candidate-synced-at', syncedAt ? syncedAt + ' 기준' : (sync.message || '국토교통부 API 연결 후 갱신됩니다.'));
  syncDot.classList.toggle('is-synced', Boolean(syncedAt));
  syncDot.classList.toggle('is-error', data.status === 'error');
  const container = document.querySelector('#candidate-list');
  container.replaceChildren();
  if (!data.candidates?.length) {
    const empty = document.createElement('article');
    empty.className = 'listing-empty';
    empty.innerHTML = '<h3>첫 가격 동기화를 기다리고 있어요.</h3><p>GitHub Action이 실행되면 요청한 후보지 3곳이 표시됩니다.</p>';
    container.append(empty);
  } else {
    data.candidates.forEach((item) => container.append(makeCandidateCard(item)));
  }
  renderRecommendations(data.recommendationPool);
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

function inferredAdministrativeRegion(item) {
  const regionName = inferredRegion(item);
  if (item.cityName) {
    return {
      provinceName: item.provinceName || '',
      cityName: item.cityName,
      districtName: item.districtName || ''
    };
  }
  if ((item.location || '').includes('서울특별시')) {
    return { provinceName: '서울특별시', cityName: '서울특별시', districtName: regionName === '기타 지역' ? '' : regionName };
  }
  const locationMatch = (item.location || '').match(/(수원시|용인시|성남시|안양시|안산시|화성시)\s+([^\s]+구)/);
  if (locationMatch) return { provinceName: '경기도', cityName: locationMatch[1], districtName: locationMatch[2] };
  const regionMatch = regionName.match(/^(수원|용인|성남|안양|안산|화성)(.+구)$/);
  if (regionMatch) return { provinceName: '경기도', cityName: regionMatch[1] + '시', districtName: regionMatch[2] };
  return { provinceName: item.provinceName || '경기도', cityName: regionName, districtName: '' };
}

function reconstructionDisplayName(item) {
  if (item.apartmentName) return item.apartmentName;
  const zoneName = item.name || '';
  const parentheticalNames = [...zoneName.matchAll(/\(([^)]+)\)/g)]
    .flatMap((match) => match[1].split(/[+·,]/))
    .map((name) => name.trim())
    .filter((name) => /아파트|주공|단지|연립|맨션|빌라/.test(name));
  if (parentheticalNames.length) return parentheticalNames.join(' · ');
  if (/아파트|주공|단지|연립|맨션|빌라/.test(zoneName)) return zoneName.replace(/구역$/, '');
  return zoneName ? zoneName + (/구역|촉진|계획|재건축|정비$/.test(zoneName) ? '' : ' 정비구역') : '재건축 단지';
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
  const administrativeRegion = inferredAdministrativeRegion(item);
  const legacyLocation = item.location === '경기도 ' + inferredRegion(item);
  const location = legacyLocation
    ? ['경기도', administrativeRegion.cityName, administrativeRegion.districtName].filter(Boolean).join(' ')
    : item.location;
  return {
    ...item,
    ...administrativeRegion,
    location,
    apartmentName: reconstructionDisplayName(item),
    regionName: inferredRegion(item),
    mapPoint: fallbackMapPoint(item)
  };
}

function locationFilterElements(scope) {
  return {
    city: document.querySelector('#' + scope + '-city-filter'),
    district: document.querySelector('#' + scope + '-district-filter')
  };
}

function updateDistrictFilter(scope) {
  const { city, district } = locationFilterElements(scope);
  const currentValue = district.value;
  const districts = city.value === 'all' ? [] : [...new Set(reconstructionItems
    .filter((item) => item.cityName === city.value)
    .map((item) => item.districtName)
    .filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ko'));
  district.replaceChildren(new Option(city.value === 'all' ? '시를 먼저 선택' : '전체 구', 'all'));
  districts.forEach((name) => district.add(new Option(name, name)));
  district.disabled = city.value === 'all' || !districts.length;
  district.value = districts.includes(currentValue) ? currentValue : 'all';
}

function populateLocationFilters(items) {
  const cities = [...new Set(items.map((item) => item.cityName).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ko'));
  ['reconstruction', 'map'].forEach((scope) => {
    const { city } = locationFilterElements(scope);
    const currentValue = city.value;
    city.replaceChildren(new Option('전체 시', 'all'));
    cities.forEach((name) => city.add(new Option(name, name)));
    city.value = cities.includes(currentValue) ? currentValue : 'all';
    updateDistrictFilter(scope);
  });
}

function filteredReconstructionItems() {
  const search = document.querySelector('#reconstruction-search').value.trim().toLocaleLowerCase('ko');
  const city = document.querySelector('#reconstruction-city-filter').value;
  const district = document.querySelector('#reconstruction-district-filter').value;
  const stage = document.querySelector('#reconstruction-stage-filter').value;
  const priceOnly = document.querySelector('#reconstruction-price-only').checked;
  const minimumPriceEok = Number(document.querySelector('#reconstruction-price-min').value) || 0;
  const maximumPriceEok = Number(document.querySelector('#reconstruction-price-max').value) || Number.POSITIVE_INFINITY;
  const sort = document.querySelector('#reconstruction-sort').value;
  const filtered = reconstructionItems.filter((item) => {
    const latestPriceEok = Number(item.latestTransaction?.priceManwon) / 10000;
    const hasPriceBoundary = minimumPriceEok > 0 || Number.isFinite(maximumPriceEok);
    const isWithinPriceRange = !hasPriceBoundary || (Number.isFinite(latestPriceEok) && latestPriceEok >= minimumPriceEok && latestPriceEok <= maximumPriceEok);
    const haystack = [item.apartmentName, item.name, item.location, item.cityName, item.districtName, ...(item.matchNames || [])].filter(Boolean).join(' ').toLocaleLowerCase('ko');
    return (!search || haystack.includes(search))
      && (city === 'all' || item.cityName === city)
      && (district === 'all' || item.districtName === district)
      && (stage === 'all' || stageGroup(item.stage) === stage)
      && (!priceOnly || Boolean(item.latestTransaction))
      && isWithinPriceRange;
  });
  return filtered.sort((left, right) => {
    const leftPrice = Number(left.latestTransaction?.priceManwon);
    const rightPrice = Number(right.latestTransaction?.priceManwon);
    if (sort === 'price-desc') return (Number.isFinite(rightPrice) ? rightPrice : -1) - (Number.isFinite(leftPrice) ? leftPrice : -1) || left.name.localeCompare(right.name, 'ko');
    if (sort === 'price-asc') return (Number.isFinite(leftPrice) ? leftPrice : Number.POSITIVE_INFINITY) - (Number.isFinite(rightPrice) ? rightPrice : Number.POSITIVE_INFINITY) || left.name.localeCompare(right.name, 'ko');
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
  const areaPrices = document.createElement('div');
  const footer = document.createElement('div');
  const source = document.createElement('a');
  const mapButton = document.createElement('button');
  const transaction = item.latestTransaction || null;
  card.className = 'reconstruction-card';
  card.dataset.reconstructionId = item.id;
  label.className = 'card-label';
  label.textContent = item.stage || '사업 단계 확인 중';
  title.textContent = item.apartmentName;
  location.className = 'location';
  location.textContent = [item.location, item.apartmentName !== item.name ? '정비구역 ' + item.name : ''].filter(Boolean).join(' · ');
  quickValues.className = 'reconstruction-quick-values';
  quickValues.append(
    makeQuickValue(transaction?.contractDate ? transaction.contractDate + ' 최근 거래' : '최근 거래', transaction ? formatPriceManwon(Number(transaction.priceManwon)) : '매칭 준비 중'),
    makeQuickValue('면적별 가격', item.areaPrices?.length ? item.areaPrices.length + '개 타입' : '거래 없음')
  );
  details.className = 'reconstruction-details';
  summary.textContent = '면적별 가격 · 사업 정보';
  detailList.append(
    makeDetailRow('사업 유형', item.projectType || '재건축'),
    makeDetailRow('다음 이정표', item.milestone || '확인 중'),
    makeDetailRow('남은 기간', item.remainingEstimate || '사업 일정 확인 필요'),
    makeDetailRow('예정 세대수', Number.isFinite(item.supplyHouseholds) && item.supplyHouseholds > 0 ? item.supplyHouseholds.toLocaleString('ko-KR') + '세대' : '확인 필요')
  );
  areaPrices.className = 'reconstruction-area-prices';
  if (item.areaPrices?.length) {
    item.areaPrices.forEach((area) => areaPrices.append(makeAreaPriceCard(area)));
  } else {
    const copy = document.createElement('p');
    copy.textContent = item.priceMessage || '최근 12개월 신고 거래가 없습니다.';
    areaPrices.append(copy);
  }
  details.append(summary, areaPrices, detailList);
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
  const transaction = document.createElement('div');
  const transactionLabel = document.createElement('small');
  const transactionPrice = document.createElement('strong');
  const areaList = document.createElement('ul');
  const details = document.createElement('dl');
  const detailButton = document.createElement('button');
  const link = document.createElement('a');
  wrapper.className = 'map-popup';
  stage.textContent = item.stage || '진행 단계 확인 중';
  title.textContent = item.apartmentName;
  location.textContent = item.location || '';
  transaction.className = 'map-popup-price';
  transactionLabel.textContent = item.latestTransaction?.contractDate ? item.latestTransaction.contractDate + ' 최근 실거래' : '최근 실거래';
  transactionPrice.textContent = item.latestTransaction ? formatPriceManwon(Number(item.latestTransaction.priceManwon)) : '매칭 준비 중';
  transaction.append(transactionLabel, transactionPrice);
  areaList.className = 'map-popup-areas';
  (item.areaPrices || []).forEach((area) => {
    const row = document.createElement('li');
    const label = document.createElement('span');
    const price = document.createElement('b');
    label.textContent = area.areaLabel || '전용 ' + area.areaTypeSqm + '㎡';
    price.textContent = formatPriceManwon(Number(area.latestPriceManwon));
    row.append(label, price);
    areaList.append(row);
  });
  if (!areaList.children.length) {
    const row = document.createElement('li');
    row.textContent = item.priceMessage || '최근 신고 거래가 없습니다.';
    areaList.append(row);
  }
  details.className = 'map-popup-details';
  details.append(
    makeDetailRow('정비구역', item.name || '확인 필요'),
    makeDetailRow('남은 기간', item.remainingEstimate || '사업 일정 확인 필요'),
    makeDetailRow('예정 세대수', Number.isFinite(item.supplyHouseholds) && item.supplyHouseholds > 0 ? item.supplyHouseholds.toLocaleString('ko-KR') + '세대' : '확인 필요')
  );
  detailButton.type = 'button';
  detailButton.dataset.reconstructionDetail = item.id;
  detailButton.textContent = '재건축 탭에서 상세 보기';
  link.href = googleMapsUrl(item);
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = 'Google Maps에서 확인';
  wrapper.append(stage, title, location, transaction, areaList, details, detailButton, link);
  return wrapper;
}

function initializePropertyMap() {
  if (propertyMap || !window.L) return;
  propertyMap = window.L.map('property-map', {
    scrollWheelZoom: true,
    wheelDebounceTime: 30,
    wheelPxPerZoomLevel: 55,
    touchZoom: true,
    zoomControl: true
  }).setView([37.32, 127.01], 10);
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
  propertyMap.on('zoomend', updateMapLabelVisibility);
  updateMapLabelVisibility();
}

function updateMapLabelVisibility() {
  if (!propertyMap) return;
  const city = document.querySelector('#map-city-filter')?.value || 'all';
  const district = document.querySelector('#map-district-filter')?.value || 'all';
  const cityProjectCount = city === 'all' ? reconstructionItems.length : reconstructionItems.filter((item) => item.cityName === city).length;
  const hasFocusedArea = district !== 'all' || (city !== 'all' && cityProjectCount <= 40);
  propertyMap.getContainer().classList.toggle('show-all-project-labels', propertyMap.getZoom() >= 12 || hasFocusedArea);
}

function updateSelectedMapProject(item) {
  const googleLink = document.querySelector('#selected-google-map-link');
  googleLink.href = googleMapsUrl(item);
  googleLink.textContent = item.apartmentName + ' · Google Maps';
}

function focusMapProject(item) {
  showTab('map');
  document.querySelector('#map-city-filter').value = 'all';
  updateDistrictFilter('map');
  renderMapProjects();
  const marker = reconstructionMarkers.get(item.id);
  if (marker && propertyMap) {
    propertyMap.setView(marker.getLatLng(), 14, { animate: true });
    marker.openPopup();
  }
  updateSelectedMapProject(item);
}

function focusReconstructionProject(item) {
  document.querySelector('#reconstruction-search').value = item.apartmentName;
  document.querySelector('#reconstruction-city-filter').value = 'all';
  updateDistrictFilter('reconstruction');
  document.querySelector('#reconstruction-stage-filter').value = 'all';
  document.querySelector('#reconstruction-price-only').checked = false;
  document.querySelector('#reconstruction-price-min').value = '';
  document.querySelector('#reconstruction-price-max').value = '';
  renderFilteredReconstruction({ resetPage: true });
  showTab('reconstruction');
  window.setTimeout(() => {
    const card = [...document.querySelectorAll('[data-reconstruction-id]')].find((element) => element.dataset.reconstructionId === item.id);
    if (!card) return;
    const details = card.querySelector('details');
    if (details) details.open = true;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function renderMapProjects() {
  initializePropertyMap();
  const list = document.querySelector('#map-project-list');
  const city = document.querySelector('#map-city-filter').value;
  const district = document.querySelector('#map-district-filter').value;
  const items = reconstructionItems.filter((item) => (city === 'all' || item.cityName === city) && (district === 'all' || item.districtName === district) && item.mapPoint);
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
    marker.bindPopup(mapPopupContent(item), { minWidth: 250, maxWidth: 320 });
    marker.bindTooltip(item.apartmentName, {
      permanent: true,
      direction: 'top',
      offset: [0, -7],
      opacity: 0.94,
      className: 'reconstruction-map-label' + (item.latestTransaction ? ' is-priority' : '')
    });
    marker.on('click', () => updateSelectedMapProject(item));
    marker.addTo(reconstructionMapLayer);
    reconstructionMarkers.set(item.id, marker);
    bounds.extend(point);
    const button = document.createElement('button');
    const name = document.createElement('b');
    const meta = document.createElement('small');
    button.type = 'button';
    button.dataset.mapProject = item.id;
    name.textContent = item.apartmentName;
    meta.textContent = [item.location, item.latestTransaction ? formatPriceManwon(Number(item.latestTransaction.priceManwon)) : null, item.stage].filter(Boolean).join(' · ');
    button.append(name, meta);
    list.append(button);
  });
  setText('#map-pin-count', '우리집 1개 · 재건축 ' + items.length.toLocaleString('ko-KR') + '개 핀');
  if (items.length) propertyMap.fitBounds(bounds, { padding: [28, 28], maxZoom: district !== 'all' ? 14 : (city !== 'all' ? 11 : 9) });
  updateMapLabelVisibility();
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
  setText('#reconstruction-shortcut-count', reconstructionItems.length ? '서울·경기 남부 ' + reconstructionItems.length.toLocaleString('ko-KR') + '개 사업' : '공식 사업 목록 확인');
  populateLocationFilters(reconstructionItems);
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

async function loadCandidates() {
  try {
    const response = await fetch('data/candidates.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('후보지 데이터 파일을 찾을 수 없습니다.');
    renderCandidates(await response.json());
  } catch (error) {
    renderCandidates({ status: 'error', sync: { message: '후보지 정보를 불러오지 못했어요.' }, candidates: [], recommendationPool: [] });
  }
}

fields.salePrice.addEventListener('input', () => {
  salePriceTouched = true;
  if (Number.isFinite(latestHomePriceManwon)) {
    setText('#current-sale-reference', '최근 실거래 ' + formatPriceManwon(latestHomePriceManwon) + (latestHomePriceContractDate ? ' · ' + latestHomePriceContractDate : '') + ' 참고 · 직접 입력값 사용 중');
  }
});

Object.values(fields).forEach((field) => {
  field.addEventListener('input', calculateFinance);
  field.addEventListener('change', calculateFinance);
});
document.querySelector('#finance-reset').addEventListener('click', () => {
  salePriceTouched = false;
  fields.salePrice.value = Number.isFinite(latestHomePriceManwon) ? String(Number((latestHomePriceManwon / 10000).toFixed(4))) : '';
  if (Number.isFinite(latestHomePriceManwon)) {
    setText('#current-sale-reference', '최근 실거래 ' + formatPriceManwon(latestHomePriceManwon) + (latestHomePriceContractDate ? ' · ' + latestHomePriceContractDate : '') + ' 기준 자동 입력');
  }
  fields.kbLow.value = String(activeKbMarket.lowEok);
  fields.kbHigh.value = String(activeKbMarket.highEok);
  fields.creditAmount.value = '0';
  fields.creditRate.value = '5';
  fields.creditInterestOnly.checked = true;
  fields.creditTerm.value = '5';
  fields.taxArea.value = '84';
  calculateFinance();
});

['#reconstruction-search', '#reconstruction-district-filter', '#reconstruction-stage-filter', '#reconstruction-sort', '#reconstruction-price-only', '#reconstruction-price-min', '#reconstruction-price-max'].forEach((selector) => {
  const element = document.querySelector(selector);
  element.addEventListener(['search', 'number'].includes(element.type) ? 'input' : 'change', () => renderFilteredReconstruction({ resetPage: true }));
});

document.querySelector('#reconstruction-city-filter').addEventListener('change', () => {
  updateDistrictFilter('reconstruction');
  renderFilteredReconstruction({ resetPage: true });
});

document.querySelector('#reconstruction-filter-reset').addEventListener('click', () => {
  document.querySelector('#reconstruction-search').value = '';
  document.querySelector('#reconstruction-city-filter').value = 'all';
  updateDistrictFilter('reconstruction');
  document.querySelector('#reconstruction-stage-filter').value = 'all';
  document.querySelector('#reconstruction-sort').value = 'progress';
  document.querySelector('#reconstruction-price-only').checked = false;
  document.querySelector('#reconstruction-price-min').value = '';
  document.querySelector('#reconstruction-price-max').value = '';
  renderFilteredReconstruction({ resetPage: true });
});

document.querySelector('#reconstruction-load-more').addEventListener('click', () => {
  visibleReconstructionCount += RECONSTRUCTION_PAGE_SIZE;
  renderFilteredReconstruction();
});

document.querySelector('#map-city-filter').addEventListener('change', () => {
  updateDistrictFilter('map');
  renderMapProjects();
});
document.querySelector('#map-district-filter').addEventListener('change', renderMapProjects);

document.addEventListener('click', (event) => {
  const detailButton = event.target.closest('[data-reconstruction-detail]');
  if (detailButton) {
    const item = reconstructionItems.find((project) => project.id === detailButton.dataset.reconstructionDetail);
    if (item) focusReconstructionProject(item);
    return;
  }
  const mapButton = event.target.closest('[data-map-project]');
  if (!mapButton) return;
  const item = reconstructionItems.find((project) => project.id === mapButton.dataset.mapProject);
  if (item) focusMapProject(item);
});

calculateFinance();
loadHomePrice();
loadCandidates();
loadReconstruction();
