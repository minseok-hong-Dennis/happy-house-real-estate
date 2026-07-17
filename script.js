const tabButtons = [...document.querySelectorAll('[data-tab-target]')];
const tabPanels = [...document.querySelectorAll('[data-tab-panel]')];
const loanForm = document.querySelector('#loan-form');
const amountInput = document.querySelector('#loan-amount-number');
const amountRange = document.querySelector('#loan-amount-range');
const rateInput = document.querySelector('#interest-rate');
const rateRange = document.querySelector('#interest-rate-range');
const termInput = document.querySelector('#loan-term');

function showTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === tabName;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== tabName;
  });
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

function formatWon(value) {
  return Math.round(value).toLocaleString('ko-KR') + '원';
}

function formatEok(value) {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '억원';
}

function formatPriceManwon(value) {
  if (!Number.isFinite(value)) return '-';
  const eok = Math.floor(value / 10000);
  const remainder = Math.round(value % 10000);
  if (eok === 0) return remainder.toLocaleString('ko-KR') + '만원';
  if (remainder === 0) return eok.toLocaleString('ko-KR') + '억원';
  return eok.toLocaleString('ko-KR') + '억 ' + remainder.toLocaleString('ko-KR') + '만원';
}

function calculateLoan() {
  const amountEok = Math.min(15, Math.max(0.5, Number(amountInput.value) || 0.5));
  const annualRate = Math.min(12, Math.max(0, Number(rateInput.value) || 0));
  const years = Number(termInput.value);
  const principal = amountEok * 100000000;
  const months = years * 12;
  const monthlyRate = annualRate / 100 / 12;
  const monthlyPayment = monthlyRate === 0
    ? principal / months
    : principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  const totalPayment = monthlyPayment * months;
  const totalInterest = totalPayment - principal;
  const burden = Math.min(92, Math.max(18, Math.round((monthlyPayment / 5000000) * 100)));

  amountInput.value = amountEok.toFixed(1);
  amountRange.value = amountEok.toFixed(1);
  rateInput.value = annualRate.toFixed(1);
  rateRange.value = annualRate.toFixed(1);

  document.querySelector('#monthly-payment').textContent = formatWon(monthlyPayment);
  document.querySelector('#payment-caption').textContent = formatEok(amountEok) + '을 연 ' + annualRate.toFixed(1) + '%, ' + years + '년 동안 상환할 때';
  document.querySelector('#total-repayment').textContent = '약 ' + formatEok(totalPayment / 100000000);
  document.querySelector('#total-interest').textContent = '약 ' + formatEok(totalInterest / 100000000);
  document.querySelector('#payment-fill').style.width = burden + '%';
  document.querySelector('#payment-level').textContent = burden < 45 ? '안정적인 수준' : burden < 70 ? '계획적으로 살펴보기' : '부담을 꼭 확인해요';

  document.querySelectorAll('[data-home-payment]').forEach((item) => { item.textContent = formatWon(monthlyPayment); });
  document.querySelectorAll('[data-home-principal]').forEach((item) => { item.textContent = formatEok(amountEok); });
  document.querySelectorAll('[data-home-interest]').forEach((item) => { item.textContent = '약 ' + formatEok(totalInterest / 100000000); });
  document.querySelectorAll('[data-home-rate]').forEach((item) => { item.textContent = '연 ' + annualRate.toFixed(1) + '%'; });
  document.querySelectorAll('[data-home-loan]').forEach((item) => { item.textContent = formatEok(amountEok) + ' · ' + years + '년 기준'; });
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
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
    values.forEach((value) => {
      const cell = document.createElement('td');
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
    const label = document.createElement('span');
    const title = document.createElement('h3');
    const description = document.createElement('p');
    label.textContent = 'DATA SOURCE';
    title.textContent = listingData?.status === 'error' ? '현재 매물 정보를 불러오지 못했어요.' : '현재 매물 데이터 연결 대기';
    description.textContent = listingData?.message || '자동 수집이 허용된 부동산 데이터 API를 연결하면 최신 매물가를 보여드려요.';
    card.append(label, title, description);
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

  setText('[data-home-price-value]', Number.isFinite(summary.latestPriceManwon) ? formatPriceManwon(Number(summary.latestPriceManwon)) : '동기화 대기');
  setText('[data-home-price-meta]', syncedAt ? '최근 실거래가 · ' + syncedAt + ' 기준' : '공식 데이터 연결 후 표시');
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

amountInput.addEventListener('input', calculateLoan);
amountRange.addEventListener('input', () => { amountInput.value = amountRange.value; calculateLoan(); });
rateInput.addEventListener('input', calculateLoan);
rateRange.addEventListener('input', () => { rateInput.value = rateRange.value; calculateLoan(); });
termInput.addEventListener('change', calculateLoan);
loanForm.addEventListener('submit', (event) => { event.preventDefault(); calculateLoan(); });
loanForm.addEventListener('reset', () => { window.setTimeout(calculateLoan, 0); });

calculateLoan();
loadHomePrice();
