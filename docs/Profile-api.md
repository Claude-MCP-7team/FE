# Profile API 연동

BE `dev`의 세션 계약에 맞춘 FE API 클라이언트는 `src/profile-api.js`에 있습니다.

## 요청 규칙

- `POST /v1/sessions`: 프로필을 선택적으로 포함해 익명 세션을 생성합니다.
- `GET /v1/sessions/{session_id}`: 저장된 프로필을 조회합니다.
- `PUT /v1/sessions/{session_id}`: 프로필을 전체 교체합니다.
- `DELETE /v1/sessions/{session_id}`: 세션을 삭제합니다.
- 세션 ID는 `sessionStorage`의 `ypc.session-id.v1`에 보관하고, 이후 요청에는 `X-Session-Id` 헤더를 붙입니다.
- API는 BE의 직접 응답 형식(`{session_id}`, `{profile, ...}`)을 사용하며 별도 `data` envelope을 추가하지 않습니다.

## 실패 및 재시도

- 삭제 성공 또는 404(이미 없는 세션)일 때만 로컬 세션 ID를 지웁니다. 네트워크·권한·서버 오류에서는 ID를 유지해 같은 세션의 삭제를 재시도할 수 있습니다.
- 조회 응답에는 `profile`이 명시되어야 합니다. `profile: null`은 입력 전 세션으로 처리하고, 누락·잘못된 타입·손상된 JSON은 `INVALID_RESPONSE`로 처리합니다. 잘못된 응답을 빈 프로필로 표시하지 않습니다.
- 응답 본문 수신 중 연결이 끊겨도 `NETWORK_ERROR`로 처리하며 세션 ID를 유지합니다.
- 위 동작은 모의 응답 회귀 테스트로 검증하며 실제 BE 연결 검증과는 별개입니다.

## 프로필 변환

`toBackendProfile()`은 기존 Profile 폼의 평면 draft를 BE의 `core/history/answers/consent` 구조로 변환합니다. 지역·학력·고용상태·혼인상태처럼 UI 값과 BE enum이 다른 값은 여기서 변환합니다.

현재 UI에 존재하지만 BE `UserProfile`에 대응 필드가 없는 `personal_income`, `household_income`, `employment_type` 값과 BE enum에 대응하지 않는 선택지는 조용히 버리지 않고 `PROFILE_MAPPING_REQUIRED` 오류를 발생시킵니다. 서버 저장 모드에서도 해당 입력은 저장을 차단하고 안내합니다. 계약 확정 후 실제 필드와 선택지를 교체해야 합니다. `policy_history`의 기존 정책 목록은 보존하며, 목록을 표현하지 못하는 yes/no 입력으로 수정하지 않습니다.

FE가 묻지 않는 `residence_continuous`는 payload에서 생략해 BE 기본값을 사용합니다. 동의 화면이 없는 현재 단계에서는 약관 버전을 임의로 고정하지 않고 `privacy_agreed_at: null`만 전달하며, `consent` 옵션으로 실제 동의 정보를 주입할 수 있습니다.

API 클라이언트 자체는 주소 생략 시 현재 origin을 사용합니다. **폼은 명시적으로 설정했을 때만 서버 모드를 사용합니다.**

## 폼 연결 및 실행

개발 서버는 `YPC_API_BASE`를 `/src/runtime-config.js` 모듈로 제공합니다. 설정하지 않으면 기존 탭 내 임시 저장 모드입니다. 다음 주소는 로컬 BE 실행 시의 예시이며 배포 주소가 아닙니다.

```powershell
$env:YPC_API_BASE = 'http://127.0.0.1:8000'
npm.cmd run dev
# 기존 디자인은 npm.cmd run preview
```

서버 재시작 후 `/profile.html` 또는 `/#/profile`에서 확인합니다. 정적 호스팅은 앱 모듈을 불러오기 전에 `globalThis.__YPC_API_BASE__`를 설정합니다. 빈 문자열을 명시하면 same-origin API를 사용합니다. 다른 origin의 BE에는 FE origin과 GET/POST/PUT/DELETE, Content-Type 및 X-Session-Id를 허용하는 CORS 설정이 필요합니다. FE 정적 서버가 API 요청을 프록시하지는 않습니다.

- 최초 조회 중에는 입력을 잠급니다. 조회 실패 시 재시도 또는 삭제가 가능하며, 기존 프로필 확인 전 저장은 차단합니다.
- 세션이 없으면 POST, 있으면 PUT으로 저장합니다. 요청 중 중복 제출·수정·삭제를 막고, 실패하면 현재 입력과 마지막 저장값을 유지합니다.
- `profile-repository.js`는 기존 문서의 복사본에서 변경한 필드만 갱신합니다. 폼에 없는 core 값, history, answers, consent를 보존합니다. FE가 편집할 수 없는 기존 enum·지역 코드는 저장된 값 유지 옵션으로 표시합니다.
- PUT에서 세션 만료(404)가 확인되면 ID를 지우고 실패를 표시합니다. 사용자가 다시 저장하면 보존된 프로필로 새 세션을 생성합니다. 자동 재생성은 하지 않습니다.
- 삭제는 확인 버튼 후 요청합니다. 실패하면 재시도할 수 있고, 성공 또는 이미 삭제된 세션이면 화면을 초기화합니다.
- 서버 모드는 로컬 초안 데이터를 자동 전송하지 않습니다. 탭을 닫으면 세션 ID를 잃으므로 서버에 저장된 데이터에 재접근할 수 없다는 안내를 제공합니다.

현재 정책 결과는 Mock입니다. 저장 성공으로 정책 판정이나 M1 전체 완료를 표시하지 않습니다. 기존 지역 선택지·코드의 세분화, 소득 및 enum 계약 확정, 실제 동의 수집, 실제 BE/CORS와 브라우저 검증은 후속 작업입니다.

## 검증

단위 테스트는 미지원 값 차단, 숨겨진 필드 보존, 조회 실패 후 저장 차단, 재시도, 동시 요청 차단, 세션 만료를 검증합니다. 임시 로컬 HTTP 서버로 POST→GET→PUT→DELETE 및 세션 헤더를 검증합니다. 이 모의 서버 검증은 실제 BE 또는 브라우저 E2E 검증을 대신하지 않습니다.
