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

amountInput.addEventListener('input', calculateLoan);
amountRange.addEventListener('input', () => { amountInput.value = amountRange.value; calculateLoan(); });
rateInput.addEventListener('input', calculateLoan);
rateRange.addEventListener('input', () => { rateInput.value = rateRange.value; calculateLoan(); });
termInput.addEventListener('change', calculateLoan);
loanForm.addEventListener('submit', (event) => { event.preventDefault(); calculateLoan(); });
loanForm.addEventListener('reset', () => { window.setTimeout(calculateLoan, 0); });

calculateLoan();
