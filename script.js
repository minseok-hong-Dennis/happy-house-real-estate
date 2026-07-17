const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');
const searchForm = document.querySelector('#home-search');
const searchMessage = document.querySelector('#search-message');
const saveButtons = document.querySelectorAll('.save-button');

if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    navigation.classList.toggle('is-open', !isOpen);
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      navigation.classList.remove('is-open');
    });
  });
}

searchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(searchForm);
  const location = formData.get('location');

  if (!location) {
    searchMessage.textContent = '먼저 살고 싶은 지역을 선택해 주세요.';
    return;
  }

  const budget = formData.get('budget');
  searchMessage.textContent = `${location}${budget ? ` · ${budget}` : ''} 조건의 추천 매물을 준비 중이에요.`;
  document.querySelector('#homes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

saveButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const saved = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!saved));
    button.setAttribute('aria-label', saved ? button.getAttribute('aria-label').replace(' 저장됨', '') : `${button.getAttribute('aria-label')} 저장됨`);
  });
});
