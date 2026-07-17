# API Key And Token Setup

이 프로젝트에서 지금 발급받아야 하는 인증키는 `MOLIT_SERVICE_KEY` 하나입니다. 국토교통부 실거래가를 조회하는 공공데이터포털 서비스키이며, 현재 매물가용 키와는 별개입니다. 키 값은 HTML, JavaScript, 커밋, 이슈, Actions 로그에 적지 말고 GitHub Actions Secret에만 등록합니다.

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

성공하면 `data/home-price.json`과 `data/reconstruction.json`이 자동 갱신됩니다. 이후에는 매일 14:00 KST에 실행됩니다. GitHub Secret은 저장 후 원문을 다시 보여주지 않으며, 같은 이름으로 새 값을 등록하면 교체됩니다.

## 3. 오류가 날 때

- `SERVICE KEY IS NOT REGISTERED ERROR`: 포털과 제공기관 사이의 키 동기화가 아직 끝나지 않았을 수 있습니다. 잠시 후 다시 실행합니다. 계속 실패하면 공공데이터포털 활용지원센터 `1566-0025`에 문의합니다.
- `국토교통부 실거래가 API 요청에 실패했습니다`: `MOLIT_SERVICE_KEY` 철자와 Secret 값 앞뒤의 공백을 확인합니다.
- Action은 성공했지만 거래가 0건: 해당 3개월에 신고 거래가 없거나 API의 단지명이 프로젝트의 단지명과 다를 수 있습니다.

## 4. 현재 매물가 키는 별도

`MOLIT_SERVICE_KEY`는 신고된 실거래가만 제공하며 현재 중개 매물은 제공하지 않습니다. 네이버 Developers의 공식 OpenAPI 목록에도 네이버 부동산 매물 조회 API가 없으므로, 네이버 Client ID나 Client Secret을 발급받아도 현재 매물가를 가져올 수 없습니다.

아래 Secret은 자동 수집을 허용하는 별도 매물 데이터 제공자와 계약했을 때만 등록합니다. 현재는 발급받을 대상이 없으므로 비워 두는 것이 맞습니다.

| Secret | 값 |
| --- | --- |
| `LISTINGS_API_URL` | 계약한 제공자가 준 HTTPS API 주소 |
| `LISTINGS_API_TOKEN` | 제공자가 발급한 토큰. 인증이 없으면 생략 |
| `LISTINGS_SOURCE_NAME` | 화면에 표시할 제공자 이름 |

네이버 부동산 웹 화면의 비공개 요청 주소나 쿠키를 복사해 자동 수집하는 방식은 사용하지 않습니다. 자세한 응답 형식은 [실거래가 동기화 문서](REAL_ESTATE_SYNC.md)를 확인합니다.

## 공식 확인 자료

- [국토교통부 아파트 매매 실거래가 자료](https://www.data.go.kr/data/15126469/openapi.do)
- [공공데이터포털 OpenAPI 활용 FAQ](https://www.data.go.kr/data/15124045/fileData.do?recommendDataYn=Y)
- [공공데이터포털 Swagger 인증키 가이드](https://www.data.go.kr/images/biz/swagger-guide/gw/gateway_swagger_guide.pdf)
- [네이버 공식 OpenAPI 종류](https://developers.naver.com/docs/common/openapiguide/apilist.md)
- [GitHub Actions Secret 등록 가이드](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets?tool=webui)
