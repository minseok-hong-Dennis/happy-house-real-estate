# NAVER Map Setup

지도 탭은 NAVER Web Dynamic Map Client ID가 설정되면 네이버 지도를 우선 사용합니다. Client ID가 없거나 도메인 인증에 실패하면 기존 OpenStreetMap 기반 지도로 자동 대체되어 화면이 비지 않습니다.

## 1. Maps Application 등록

1. [네이버 클라우드 플랫폼 콘솔](https://console.ncloud.com/)에 로그인합니다.
2. `Services > Application Services > Maps > Application`으로 이동합니다.
3. Maps 이용 신청이 되어 있지 않다면 이용 신청을 진행한 후 `Application 등록`을 누릅니다.
4. Application 이름을 입력하고 API에서 `Dynamic Map`의 Web 환경을 선택합니다.
5. Web 서비스 URL에는 `https://minseok-hong-dennis.github.io`를 등록합니다. 저장소 경로인 `/happy-house-real-estate`는 붙이지 않습니다.
6. 로컬에서도 확인하려면 Web 서비스 URL에 `http://localhost`를 추가합니다. 포트와 페이지 경로는 입력하지 않습니다.
7. 등록을 완료한 뒤 Application 목록의 `인증 정보`에서 **Client ID**를 복사합니다.

공식 절차는 [Maps Application 가이드](https://guide.ncloud-docs.com/docs/application-maps-app-vpc)와 [Web Dynamic Map 시작 가이드](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html)를 기준으로 합니다. Maps는 종량 요금제이므로 [Maps 사용 준비와 요금 안내](https://guide.ncloud-docs.com/docs/application-maps-spec)에서 현재 무료 이용량과 요금을 확인하고 일·월 이용 한도를 설정하는 것을 권장합니다.

## 2. GitHub Repository Variable 등록

1. 이 저장소의 [Actions variables 설정](https://github.com/minseok-hong-Dennis/happy-house-real-estate/settings/variables/actions)을 엽니다.
2. `New repository variable`을 누릅니다.
3. Name에는 정확히 `NAVER_MAPS_CLIENT_ID`를 입력합니다.
4. Value에는 앞에서 복사한 Client ID만 입력하고 저장합니다.
5. [Sync home price data Action](https://github.com/minseok-hong-Dennis/happy-house-real-estate/actions/workflows/sync-home-price.yml)에서 `Run workflow`를 한 번 실행합니다.

Action은 Repository Variable을 `data/map-config.json`에 반영합니다. Web Dynamic Map은 브라우저가 Client ID를 요청 URL에 포함하므로 Client ID는 사용자에게 보일 수 있으며, 등록한 Web 서비스 URL 제한으로 보호합니다. **Client Secret은 이 웹사이트와 GitHub Variable 또는 Secret 어디에도 등록하지 않습니다.**

## 3. 확인과 문제 해결

- 지도 상단에 `네이버 지도`가 표시되면 전환이 완료된 상태입니다.
- 계속 `기본 지도`가 표시되면 `data/map-config.json`의 `naverMapsClientId`가 비어 있는지 확인합니다.
- 인증 오류가 발생하면 Maps Application의 Web 서비스 URL이 `https://minseok-hong-dennis.github.io`인지 확인합니다. 포트나 `/happy-house-real-estate` 경로가 있으면 제거합니다.
- Client ID를 변경했다면 GitHub Repository Variable을 교체하고 Action을 다시 수동 실행합니다.
- 네이버 지도 스크립트가 일시적으로 실패해도 기존 지도로 자동 대체됩니다.

[네이버 공식 Maps 문제 해결](https://guide.ncloud-docs.com/docs/application-maps-troubleshoot)에서도 도메인 등록과 인증 파라미터 오류를 확인할 수 있습니다.
