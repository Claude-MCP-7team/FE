# 역질문 API와 재판정 흐름

BE `dev`의 [질문 큐 생성](https://github.com/Claude-MCP-7team/BE/blob/dev/app/engine/questions.py)과 [질문 DTO](https://github.com/Claude-MCP-7team/BE/blob/dev/app/schemas/question.py)에 맞춰 구현했습니다.

서버 모드에서 실제 판정 결과가 있으면 `#/questions`가 `POST /v1/questions`를 호출합니다. 질문은 정책별이 아니라 `field` 기준으로 병합되며, 화면의 완료 예정 수는 `resolves`만 표시합니다. `affects`는 화면 문구에 사용하지 않습니다.

답변은 질문의 `field`를 key로 하는 `answers` 객체로 만들고, 비어 있는 답변은 전송하지 않습니다. 기존 프로필의 `answers`와 병합한 전체 `UserProfile`을 세션 `PUT`으로 저장한 뒤 같은 문서를 `POST /v1/judge?include=all`에 보내 재판정합니다. 별도 answers API나 polling은 사용하지 않습니다.

`answer_type`은 `boolean`, `number`, `choice`만 허용합니다. 숫자는 0 이상의 안전한 정수, 선택지는 서버가 내려준 목록의 값만 허용합니다. 질문 큐·답변 값이 잘못되면 서버 요청 전에 중단하고 필드 오류를 표시합니다. `source_quote`와 `source_policy_ids`를 함께 보여주며, 질문 문구나 근거를 FE에서 생성하지 않습니다.

API 주소가 없거나 아직 실제 판정 결과가 없으면 기존 Mock 질문 안내를 유지합니다. 질문 요청·저장·재판정 중 오류는 화면에 남기고, 이전 답변과 서버 프로필은 삭제하지 않습니다. 실제 BE/CORS·브라우저 E2E는 후속 검증 대상입니다.
