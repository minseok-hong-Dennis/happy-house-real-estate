# API Key And Token Setup

이 문서는 가격 동기화 GitHub Action에 필요한 키를 발급하고 등록하는 방법입니다. 키 값은 절대로 HTML, JavaScript, 커밋, 이슈에 적지 말고 GitHub Secrets에만 등록합니다.

## 1. 국토교통부 실거래가 서비스 키

1. [공공데이터포털의 국토교통부 아파트 매매 실거래가 자료](https://www.data.go.kr/data/15126469/openapi.do)를 엽니다.
2. 공공데이터포털에 로그인하거나 회원가입합니다.
3. `활용신청`을 선택하고, 안내에 따라 API 사용 신청을 완료합니다. 승인 후 `마이페이지 > 인증키`에서 서비스 키를 확인합니다.
4. 이 저장소의 GitHub 페이지에서 `Settings > Secrets and variables > Actions`를 엽니다.
5. `New repository secret`을 선택하고 이름을 `MOLIT_SERVICE_KEY`로 입력한 뒤, 서비스 키를 값으로 붙여 넣습니다.
6. `Actions > Sync home price data > Run workflow`에서 수동 실행해 첫 동기화를 확인합니다. 이후에는 매일 14:00 KST에 실행되며, 우리집 가격과 재건축 탭의 실거래가를 함께 갱신합니다.

공공데이터포털 키는 API 호출에만 사용합니다. 키가 노출되었다고 의심되면 포털에서 재발급하고 GitHub Secret도 즉시 교체합니다.

## 2. 현재 매물가 제공자 키

현재 매물가는 자동 수집을 명시적으로 허용한 데이터 제공자의 API만 연결합니다. 네이버 부동산 화면을 자동으로 긁어오는 방식은 사용하지 않습니다.

제공자와 계약하거나 API 접근 권한을 받은 뒤, 발급 문서에 따라 아래 값을 GitHub Secrets에 등록합니다.

| Secret | 값 |
| --- | --- |
| `LISTINGS_API_URL` | 제공자가 준 HTTPS API 주소 |
| `LISTINGS_API_TOKEN` | 제공자가 발급한 토큰. 필요 없는 API라면 생략 가능 |
| `LISTINGS_SOURCE_NAME` | 화면에 표시할 제공자 이름 |

API는 배열 또는 `items`/`listings` 배열을 반환해야 하며, 각 항목에는 `priceManwon`이 필요합니다. 선택 값은 `title`, `tradeType`, `areaSqm`, `floor`입니다. 자세한 형식은 [실거래가 동기화 문서](REAL_ESTATE_SYNC.md)를 확인합니다.

## 3. GitHub Secret 등록 위치

GitHub 공식 안내 기준으로 저장소 관리자 권한이 있는 계정에서 `Settings > Secrets and variables > Actions > New repository secret` 순서로 등록합니다. Secret은 등록 후 원문을 다시 볼 수 없으므로, 이름과 값이 맞는지 붙여 넣기 전에 확인합니다.

참고 문서:

- [GitHub Actions secrets 공식 가이드](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets?tool=webui)
- [공공데이터포털 국토교통부 아파트 매매 실거래가 자료](https://www.data.go.kr/data/15126469/openapi.do)
