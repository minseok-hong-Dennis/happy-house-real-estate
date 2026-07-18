# API Key And Token Setup

이 프로젝트는 공공데이터포털 키를 용도별 GitHub Secret인 `MOLIT_SERVICE_KEY`와 `RECONSTRUCTION_SERVICE_KEY`에 등록합니다. 포털에서 복사하는 실제 서비스키 값은 같을 수 있지만, 두 API의 `활용신청`과 Action의 연결 상태를 구분하기 위해 Secret 이름을 분리합니다. 현재 매물가나 KB 시세 제공자용 키와는 별개입니다. 키 값은 HTML, JavaScript, 커밋, 이슈, Actions 로그에 적지 말고 GitHub Actions Secret에만 등록합니다.

네이버 지도용 Client ID 발급과 도메인 등록은 [NAVER_MAP_SETUP.md](NAVER_MAP_SETUP.md)를 참고하세요. 지도에는 Client ID만 사용하며 Client Secret은 등록하지 않습니다.

## 1. MOLIT_SERVICE_KEY 발급

### 신청할 공식 API

- API 이름: `국토교통부_아파트 매매 실거래가 자료`
- 공식 신청 페이지: [공공데이터포털 OpenAPI 상세](https://www.data.go.kr/data/15126469/openapi.do)
- 이 프로젝트가 호출하는 기능: `GET /getRTMSDataSvcAptTrade`
- 공식 Base URL: `apis.data.go.kr/1613000/RTMSDataSvcAptTrade`
- 비용과 승인: 무료, 개발계정 자동승인
- 개발계정 트래픽: 일 10,000회

### 정확한 발급 순서

1. PC 브라우저에서 [공공데이터포털](https://www.data.go.kr/)에 회원가입하고 로그인합니다. 활용신청은 PC 화면에서 진행합니다.
2. [국토교통부_아파트 매매 실거래가 자료](https://www.data.go.kr/data/15126469/openapi.do)를 열고 `활용신청`을 누릅니다.
3. 활용 목적에는 개인 웹사이트에서 아파트 실거래가를 조회한다고 입력하고 신청을 완료합니다. 이 API의 개발계정은 자동승인입니다.
4. `마이페이지 > 데이터활용 > Open API > 활용신청 현황`으로 이동합니다.
5. 목록에서 `국토교통부_아파트 매매 실거래가 자료`의 상세보기를 엽니다.
6. `일반 인증키` 영역에서 **Decoding 키**를 복사합니다. 포털의 Swagger 가이드도 API 입력에는 `일반 인증키(Decoding)` 사용을 안내합니다.

공공데이터포털 서비스키는 사용자당 하나이며, 신청한 여러 OpenAPI에 같은 키를 사용합니다. 이미 서비스키가 있다면 새로 재발급하지 말고 기존 키를 사용합니다. 재발급하면 기존 키가 폐기되므로 이 저장소의 Secret도 함께 교체해야 합니다.

## 2. GitHub에 등록

1. 이 저장소의 [Actions secrets 설정](https://github.com/minseok-hong-Dennis/happy-house-real-estate/settings/secrets/actions)을 엽니다.
2. `New repository secret`을 누릅니다.
3. Name에는 정확히 `MOLIT_SERVICE_KEY`를 입력합니다.
4. Secret에는 앞에서 복사한 `일반 인증키(Decoding)` 값만 붙여 넣습니다.
5. `Add secret`을 누릅니다.
6. [Sync home price data Action](https://github.com/minseok-hong-Dennis/happy-house-real-estate/actions/workflows/sync-home-price.yml)을 열고 `Run workflow > Run workflow`로 한 번 수동 실행합니다.

성공하면 `data/home-price.json`, `data/candidates.json`, `data/reconstruction.json`, `data/sync-status.json`이 자동 갱신됩니다. 이후에는 매일 14:00 KST에 실행됩니다. GitHub Secret은 저장 후 원문을 다시 보여주지 않으며, 같은 이름으로 새 값을 등록하면 교체됩니다.

## 3. 전국 재건축 데이터 활용신청

재건축 목록은 국토교통부의 `전국 도시정비사업 통합 데이터`를 사용합니다. 경기도 남부의 `재건축` 사업만 선별하며, 현 사업추진단계와 사업유형, 사업시행자, 공급 예정 세대수를 가져옵니다.

1. [국토교통부 전국 도시정비사업 통합 데이터](https://www.data.go.kr/data/15160169/fileData.do)를 엽니다.
2. `오픈API` 탭에서 `활용신청`을 누르고 개발계정 신청을 완료합니다.
3. `마이페이지 > 데이터활용 > Open API > 활용신청 현황`에서 해당 신청이 승인 또는 개발계정 상태인지 확인합니다.
4. 저장소의 [Actions secrets 설정](https://github.com/minseok-hong-Dennis/happy-house-real-estate/settings/secrets/actions)에서 `New repository secret`을 누릅니다.
5. Name에는 `RECONSTRUCTION_SERVICE_KEY`, Secret에는 포털의 기존 `일반 인증키(Decoding)` 값을 등록합니다. 포털 키 자체는 재발급하지 않습니다.
6. 신청 직후 API가 아직 활성화되지 않았을 때 Action은 같은 페이지의 공식 CSV로 자동 대체합니다. 공식 CSV 다운로드도 일시 중단되면 저장소에 기록한 최신 공식 데이터 스냅샷을 사용해 기존 목록을 안전하게 유지합니다.

이 데이터는 전국 정비사업의 구역명, 현재 단계, 사업유형, 사업시행자, 공급 예정 세대수를 제공하지만 정확한 준공 예정일은 제공하지 않습니다. 화면의 남은 기간은 현재 사업단계에 따른 범위 추정치입니다.

## 4. 오류가 날 때

- `HTTP 401: Unauthorized` 또는 `SERVICE KEY IS NOT REGISTERED ERROR`: 포털과 제공기관 사이의 키 동기화가 아직 끝나지 않았거나 등록한 값이 잘못된 상태입니다. `일반 인증키(Decoding)`와 Secret 이름을 확인하고 잠시 후 다시 실행합니다. 계속 실패하면 공공데이터포털 활용지원센터 `1566-0025`에 문의합니다.
- `국토교통부 실거래가 API 요청에 실패했습니다`: `MOLIT_SERVICE_KEY` 철자와 Secret 값 앞뒤의 공백을 확인합니다.
- 재건축 사업 원본이 계속 `저장된 공식 데이터`로 표시됨: `전국 도시정비사업 통합 데이터` 활용신청 상태와 `RECONSTRUCTION_SERVICE_KEY` 등록 여부를 확인합니다.
- Action은 성공했지만 거래가 0건: 해당 3개월에 신고 거래가 없거나 API의 단지명이 프로젝트의 단지명과 다를 수 있습니다.

필수 실거래가 API 인증이나 호출이 실패하면 Action은 실패 상태로 종료되고 기존 가격 JSON을 덮어쓰지 않습니다. 선택형 매물·KB 제공자가 일시 실패하면 마지막 정상값을 `stale` 상태로 보존합니다. 각 소스의 결과는 Action 실행 요약과 `data/sync-status.json`에서 확인할 수 있으며, 로그에는 키 값 없이 HTTP 상태나 공공데이터 오류코드만 표시됩니다.

## 5. 현재 매물가 키는 별도

`MOLIT_SERVICE_KEY`는 신고된 실거래가만 제공하며 현재 중개 매물은 제공하지 않습니다. 네이버 Developers의 공식 OpenAPI 목록에도 네이버 부동산 매물 조회 API가 없으므로, 네이버 Client ID나 Client Secret을 발급받아도 현재 매물가를 가져올 수 없습니다.

아래 Secret은 자동 수집을 허용하는 별도 매물 데이터 제공자와 계약했을 때만 등록합니다. 현재는 발급받을 대상이 없으므로 비워 두는 것이 맞습니다.

| Secret | 값 |
| --- | --- |
| `LISTINGS_API_URL` | 계약한 제공자가 준 HTTPS API 주소 |
| `LISTINGS_API_TOKEN` | 제공자가 발급한 토큰. 인증이 없으면 생략 |
| `LISTINGS_SOURCE_NAME` | 화면에 표시할 제공자 이름 |

네이버 부동산 웹 화면의 비공개 요청 주소나 쿠키를 복사해 자동 수집하는 방식은 사용하지 않습니다. 자세한 응답 형식은 [실거래가 동기화 문서](REAL_ESTATE_SYNC.md)를 확인합니다.

## 6. KB 시세 API

KB부동산은 웹과 데이터허브에서 KB시세를 조회할 수 있지만, 단지·면적별 상한가와 하한가를 외부 프로그램이 조회하는 공개 개발자 API와 발급 절차는 현재 공식 문서에서 확인되지 않습니다. 따라서 KB 웹사이트의 내부 요청 주소나 세션 쿠키를 Action에서 수집하지 않으며, 대출 관리 화면에서 직접 입력하는 것이 기본입니다.

대출 관리 화면에는 [매교역푸르지오SK뷰](https://kbland.kr/se/c/48414) 전용 84.97㎡의 2026-07-17 KB 매매시세를 수동 확인해 하한 9억 1,000만원, 상한 10억 7,000만원을 참고 기본값으로 넣었습니다. 이 값은 자동 갱신되지 않으므로 실제 대출 검토 전에는 KB부동산에서 최신 값을 다시 확인합니다.

회사 또는 정식 데이터 제휴사를 통해 반복 호출이 허용된 API를 받은 경우에만 아래 Secret을 등록합니다. 연결되면 Action이 시세를 저장하고 대출 관리의 KB 상·하한을 자동 입력합니다.

| Secret | 값 |
| --- | --- |
| `KB_MARKET_API_URL` | 계약한 제공자가 준 HTTPS API 주소 |
| `KB_MARKET_API_TOKEN` | 제공자가 발급한 Bearer 토큰. 인증이 없으면 생략 |
| `KB_MARKET_SOURCE_NAME` | 화면에 표시할 제공자 이름 |

응답은 `lowPriceEok`와 `highPriceEok`, 또는 `lowPriceManwon`와 `highPriceManwon`, 또는 `lowPriceWon`와 `highPriceWon` 필드를 포함해야 합니다.

## 7. 동기화 상태 확인

[Sync home price data Action](https://github.com/minseok-hong-Dennis/happy-house-real-estate/actions/workflows/sync-home-price.yml)의 실행 상세 상단 `Summary`에서 우리집 실거래가, 이사 후보지, 재건축 사업 원본, 재건축 실거래가, 현재 매물, KB 시세의 상태와 건수를 확인할 수 있습니다. 같은 내용은 저장소의 `data/sync-status.json`에도 기록됩니다.

- `ok`: 최신 수집 완료
- `fallback`: Open API 또는 공식 CSV 대신 저장된 최신 공식 스냅샷 사용
- `partial`: 일부 대상 갱신 실패, 가능한 기존 값 유지
- `stale`: 선택형 제공자 호출 실패, 마지막 정상값 유지
- `not_configured` 또는 `not_available`: 허용된 매물·KB API가 연결되지 않음

## 공식 확인 자료

- [국토교통부 아파트 매매 실거래가 자료](https://www.data.go.kr/data/15126469/openapi.do)
- [국토교통부 전국 도시정비사업 통합 데이터](https://www.data.go.kr/data/15160169/fileData.do)
- [KB부동산 데이터허브](https://data.kbland.kr/kbstats/)
- [공공데이터포털 OpenAPI 활용 FAQ](https://www.data.go.kr/data/15124045/fileData.do?recommendDataYn=Y)
- [공공데이터포털 Swagger 인증키 가이드](https://www.data.go.kr/images/biz/swagger-guide/gw/gateway_swagger_guide.pdf)
- [네이버 공식 OpenAPI 종류](https://developers.naver.com/docs/common/openapiguide/apilist.md)
- [네이버 Maps Application 등록](https://guide.ncloud-docs.com/docs/application-maps-app-vpc)
- [네이버 Web Dynamic Map 시작](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html)
- [GitHub Actions Secret 등록 가이드](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets?tool=webui)
