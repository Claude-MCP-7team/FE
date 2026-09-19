# 조합 추천 API 연결

BE `dev`의 `POST /v1/combinations`는 저장된 `UserProfile`을 받아 `conservative`와 `maximal` 시나리오를 반환합니다. 각 조합은 구성 정책, 예상 총액, 제외 정책과 중복수혜 근거를 포함합니다.

서버 모드의 `#/combinations` 화면은 세션 프로필을 조회한 뒤 이 API를 호출합니다. FE는 금액이나 충돌 여부를 계산하지 않고 BE가 반환한 순위·추정 여부·원문 근거만 표시합니다. 원문 URL은 `http`/`https`만 링크로 사용하며 응답 계약을 먼저 검증합니다.

API 오류, 빈 추천, 로딩, 취소, 재시도 상태를 화면에 표시합니다. API 주소가 없으면 기존 Mock 조합 화면을 유지합니다.
