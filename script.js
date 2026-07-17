const tabButtons = [...document.querySelectorAll('[data-tab-target]')];
const tabPanels = [...document.querySelectorAll('[data-tab-panel]')];

const fields = {
  purchase: document.querySelector('#purchase-price'),
  kbLow: document.querySelector('#kb-low-price'),
  kbHigh: document.querySelector('#kb-high-price'),
  companyAmount: document.querySelector('#company-loan-amount'),
  taxRate: document.querySelector('#company-tax-rate'),
  companyMethod: document.querySelector('#company-repayment-method'),
  creditAmount: document.querySelector('#credit-loan-amount'),
  creditRate: document.querySelector('#credit-loan-rate'),
  creditTerm: document.querySelector('#credit-loan-term'),
  taxPrice: document.querySelector('#tax-price'),
  taxArea: document.querySelector('#tax-area'),
  taxHomeCount: document.querySelector('#tax-home-count')
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

function monthlyLoanPayment(principal, annualRate, months, method = 'annuity') {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (method === 'equal-principal') return principal / months + principal * monthlyRate;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return principal * (monthlyRate * factor) / (factor - 1);
}

function setMoneyInput(element, amountEok) {
  element.value = amountEok.toFixed(2).replace(/\.00$/, '');
}

function companyLoanLimit() {
  const purchase = numberValue(fields.purchase);
  const kbLow = numberValue(fields.kbLow);
  const kbHigh = numberValue(fields.kbHigh);
  if (![purchase, kbLow, kbHigh].every((value) => Number.isFinite(value) && value > 0)) return Number.NaN;
  return Math.min(5, purchase * 0.7, ((kbLow + kbHigh) / 2) * 0.7);
}

function calculateFinance() {
  const limitEok = companyLoanLimit();
  const companyAmountInput = numberValue(fields.companyAmount);
  let companyAmountEok = companyAmountInput;

  if (Number.isFinite(limitEok)) {
    if (!Number.isFinite(companyAmountEok) || fields.companyAmount.dataset.manual !== 'true') {
      companyAmountEok = limitEok;
      setMoneyInput(fields.companyAmount, companyAmountEok);
    } else if (companyAmountEok > limitEok) {
      companyAmountEok = limitEok;
      setMoneyInput(fields.companyAmount, companyAmountEok);
    }
  }

  setText('#company-loan-limit', formatEok(limitEok));
  setTextAll('[data-home-company-limit]', formatEok(limitEok));
  setTextAll('[data-home-company-detail]', Number.isFinite(limitEok) ? '실행 금액은 한도 내에서 조절할 수 있어요.' : '매매가와 KB 시세를 입력해 주세요.');

  const companyPrincipal = Number.isFinite(companyAmountEok) && Number.isFinite(limitEok) ? Math.max(0, Math.min(companyAmountEok, limitEok)) * 100000000 : 0;
  const personalRate = 1.5;
  const companyRate = 3.1;
  const totalRate = personalRate + companyRate;
  const taxRate = Math.max(0, numberValue(fields.taxRate) || 0) / 100;
  const gracePersonal = companyPrincipal * (personalRate / 100 / 12);
  const graceSubsidy = companyPrincipal * (companyRate / 100 / 12);
  const graceSubsidyTax = graceSubsidy * taxRate;
  const companyBankPayment = monthlyLoanPayment(companyPrincipal, totalRate, 120, fields.companyMethod.value);
  const firstMonthSubsidy = graceSubsidy;
  const firstMonthSubsidyTax = firstMonthSubsidy * taxRate;
  const companyRepaymentCost = companyBankPayment - firstMonthSubsidy + firstMonthSubsidyTax;

  const creditAmount = Math.max(0, numberValue(fields.creditAmount) || 0) * 100000000;
  const creditRate = Math.max(0, numberValue(fields.creditRate) || 0);
  const creditMonths = Math.max(1, Number(fields.creditTerm.value) || 5) * 12;
  const creditPayment = monthlyLoanPayment(creditAmount, creditRate, creditMonths);
  const graceTotal = companyPrincipal > 0 ? gracePersonal + graceSubsidyTax + creditPayment : Number.NaN;
  const repaymentTotal = companyPrincipal > 0 ? companyRepaymentCost + creditPayment : Number.NaN;

  setText('#credit-monthly-payment', formatWon(creditPayment));
  setText('#company-loan-result', companyPrincipal > 0 ? formatEok(companyPrincipal / 100000000) : '-');
  setText('#company-subsidy', companyPrincipal > 0 ? formatWon(firstMonthSubsidy) : '-');
  setText('#company-subsidy-tax', companyPrincipal > 0 ? formatWon(firstMonthSubsidyTax) : '-');
  setText('#credit-impact', creditAmount > 0 ? '월 +' + formatWon(creditPayment) : '변화 없음');
  setText('#grace-monthly-cost', formatWon(graceTotal));
  setText('#repayment-monthly-cost', formatWon(repaymentTotal));
  setText('#bank-monthly-payment', companyPrincipal > 0 ? formatWon(companyBankPayment + creditPayment) : '입력 필요');
  setText('#grace-monthly-caption', companyPrincipal > 0 ? '개인 이자 + 지원이자 세금 + 신용대출' : '사내 대출 실행 금액을 확인해 주세요.');
  setText('#repayment-monthly-caption', companyPrincipal > 0 ? '사내 대출 상환 + 신용대출' : '사내 대출 실행 금액을 확인해 주세요.');
  setText('#bank-monthly-caption', companyPrincipal > 0 ? '회사 부담분을 포함한 금액' : '사내 대출 실행 금액을 확인해 주세요.');
  setTextAll('[data-home-monthly-cost]', formatWon(repaymentTotal));
  setTextAll('[data-home-loan-summary]', companyPrincipal > 0 ? '37개월차 · 신용대출 포함' : '대출 관리에서 계산합니다.');

  calculateTaxes();
}

function calculateTaxes() {
  const price = numberValue(fields.taxPrice) * 100000000;
  const area = numberValue(fields.taxArea);
  const isOneHome = fields.taxHomeCount.value === 'one';
  if (!Number.isFinite(price) || price <= 0 || !isOneHome) {
    setText('#tax-total', isOneHome ? '입력 필요' : '확인 필요');
    setText('#acquisition-tax', '-');
    setText('#local-education-tax', '-');
    setText('#rural-special-tax', '-');
    setText('#tax-disclaimer', isOneHome ? '중과세, 감면, 일시적 2주택, 법인 취득, 등기·중개 수수료는 포함하지 않습니다. 계약 전 관할 세무 부서 또는 전문가에게 확인해 주세요.' : '다주택·법인·기타 취득은 지역과 주택 수에 따른 중과 여부가 달라 이 계산기에서 제외했습니다. 관할 세무 부서 또는 전문가에게 확인해 주세요.');
    return;
  }

  let acquisitionRate;
  if (price <= 600000000) acquisitionRate = 0.01;
  else if (price <= 900000000) acquisitionRate = ((price / 100000000) * 2 / 3 - 3) / 100;
  else acquisitionRate = 0.03;

  const acquisitionTax = price * acquisitionRate;
  const localEducationTax = acquisitionTax * 0.1;
  const ruralSpecialTax = Number.isFinite(area) && area > 85 ? price * 0.002 : 0;
  const total = acquisitionTax + localEducationTax + ruralSpecialTax;
  setText('#tax-total', formatWon(total));
  setText('#acquisition-tax', formatWon(acquisitionTax));
  setText('#local-education-tax', formatWon(localEducationTax));
  setText('#rural-special-tax', formatWon(ruralSpecialTax));
  setText('#tax-disclaimer', '1주택 일반 매수 기준 추정입니다. 중과세, 감면, 일시적 2주택, 법인 취득, 등기·중개 수수료는 포함하지 않습니다. 계약 전 관할 세무 부서 또는 전문가에게 확인해 주세요.');
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
  setText('#home-price-sync', syncedAt ? syncedAt + ' 기준' : '대기 중');
  syncDot.classList.toggle('is-synced', Boolean(syncedAt));
  syncDot.classList.toggle('is-error', trades.status === 'error');
  setText('#trade-period', trades.periodLabel || '동기화 후 거래 기간을 표시합니다.');
  setText('#trade-count', Number.isFinite(summary.count) ? summary.count.toLocaleString('ko-KR') + '건' : '-');
  setText('#trade-average', formatPriceManwon(Number(summary.averagePriceManwon)));
  setText('#trade-latest', formatPriceManwon(Number(summary.latestPriceManwon)));
  renderTransactionRows(trades.records);
  renderListings(data.currentListings);
  setTextAll('[data-home-price-value]', Number.isFinite(summary.latestPriceManwon) ? formatPriceManwon(Number(summary.latestPriceManwon)) : '동기화 대기');
  setTextAll('[data-home-price-meta]', syncedAt ? '최근 실거래가 · ' + syncedAt + ' 기준' : '공식 데이터 연결 후 표시');
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

const standardFields = Object.values(fields).filter((field) => ![fields.purchase, fields.companyAmount, fields.taxPrice].includes(field));
standardFields.forEach((field) => {
  field.addEventListener('input', calculateFinance);
  field.addEventListener('change', calculateFinance);
});
fields.companyAmount.addEventListener('input', () => {
  fields.companyAmount.dataset.manual = 'true';
  calculateFinance();
});
fields.companyAmount.addEventListener('change', calculateFinance);
fields.taxPrice.addEventListener('input', () => {
  fields.taxPrice.dataset.manual = 'true';
  calculateFinance();
});
fields.taxPrice.addEventListener('change', calculateFinance);
fields.purchase.addEventListener('input', () => {
  if (fields.taxPrice.dataset.manual !== 'true') fields.taxPrice.value = fields.purchase.value;
  calculateFinance();
});
fields.purchase.addEventListener('change', calculateFinance);
document.querySelector('#apply-company-limit').addEventListener('click', () => {
  const limit = companyLoanLimit();
  if (!Number.isFinite(limit)) return;
  fields.companyAmount.dataset.manual = 'false';
  setMoneyInput(fields.companyAmount, limit);
  calculateFinance();
});
document.querySelector('#loan-reset').addEventListener('click', () => {
  fields.purchase.value = '';
  fields.kbLow.value = '';
  fields.kbHigh.value = '';
  fields.companyAmount.value = '';
  fields.companyAmount.dataset.manual = 'false';
  fields.taxRate.value = '24.2';
  fields.companyMethod.value = 'annuity';
  fields.creditAmount.value = '0';
  fields.creditRate.value = '5';
  fields.creditTerm.value = '5';
  fields.taxPrice.value = '';
  fields.taxPrice.dataset.manual = 'false';
  fields.taxArea.value = '84';
  fields.taxHomeCount.value = 'one';
  calculateFinance();
});

calculateFinance();
loadHomePrice();
