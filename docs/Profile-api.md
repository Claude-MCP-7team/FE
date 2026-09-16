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

현재 UI에 존재하지만 BE `UserProfile`에 대응 필드가 없는 `personal_income`, `household_income`, `employment_type` 값과 BE enum에 대응하지 않는 선택지는 조용히 버리지 않고 `PROFILE_MAPPING_REQUIRED` 오류를 발생시킵니다. 실제 폼 제출을 연결할 때는 해당 값을 BE 필드로 바꾸거나, 팀에서 수집하지 않기로 결정한 뒤 제거해야 합니다.

FE가 묻지 않는 `residence_continuous`는 payload에서 생략해 BE 기본값을 사용합니다. 동의 화면이 없는 현재 단계에서는 약관 버전을 임의로 고정하지 않고 `privacy_agreed_at: null`만 전달하며, `consent` 옵션으로 실제 동의 정보를 주입할 수 있습니다.

API 주소는 `globalThis.__YPC_API_BASE__`로 지정할 수 있으며, 지정하지 않으면 현재 origin을 사용합니다.

## 다음 연결 작업

폼 제출 시 `toBackendProfile(draft)`를 호출한 뒤 세션이 없으면 `create()`, 있으면 `put()`을 호출하면 됩니다. 분석 시작 시 같은 세션 ID로 `/v1/judge`를 호출하고, 응답의 `ELIGIBLE`, `INELIGIBLE`, `NEEDS_INFO` 상태를 기존 결과 화면 상태에 매핑합니다.
