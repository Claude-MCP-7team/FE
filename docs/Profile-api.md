# Profile API 연동

BE `dev`의 세션 계약에 맞춘 FE API 클라이언트는 `src/profile-api.js`에 있습니다.

## 요청 규칙

- `POST /v1/sessions`: 프로필을 선택적으로 포함해 익명 세션을 생성합니다.
- `GET /v1/sessions/{session_id}`: 저장된 프로필을 조회합니다.
- `PUT /v1/sessions/{session_id}`: 프로필을 전체 교체합니다.
- `DELETE /v1/sessions/{session_id}`: 세션을 삭제합니다.
- 세션 ID는 `sessionStorage`의 `ypc.session-id.v1`에 보관하고, 이후 요청에는 `X-Session-Id` 헤더를 붙입니다.
- API는 BE의 직접 응답 형식(`{session_id}`, `{profile, ...}`)을 사용하며 별도 `data` envelope을 추가하지 않습니다.

## 프로필 변환

`toBackendProfile()`은 기존 Profile 폼의 평면 draft를 BE의 `core/history/answers/consent` 구조로 변환합니다. 지역·학력·고용상태·혼인상태처럼 UI 값과 BE enum이 다른 값은 여기서 변환합니다.

현재 UI에 존재하지만 BE `UserProfile`에 대응 필드가 없는 `personal_income`, `household_income`, `employment_type` 값은 조용히 버리지 않고 `PROFILE_MAPPING_REQUIRED` 오류를 발생시킵니다. 실제 폼 제출을 연결할 때는 해당 값을 BE 필드로 바꾸거나, 팀에서 수집하지 않기로 결정한 뒤 제거해야 합니다.

API 주소는 `globalThis.__YPC_API_BASE__`로 지정할 수 있으며, 지정하지 않으면 현재 origin을 사용합니다.

## 다음 연결 작업

폼 제출 시 `toBackendProfile(draft)`를 호출한 뒤 세션이 없으면 `create()`, 있으면 `put()`을 호출하면 됩니다. 분석 시작 시 같은 세션 ID로 `/v1/judge`를 호출하고, 응답의 `ELIGIBLE`, `INELIGIBLE`, `NEEDS_INFO` 상태를 기존 결과 화면 상태에 매핑합니다.
