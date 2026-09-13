# Frontend M0 계약 초안

작성일: 2026-09-12 · 버전: `0.1-draft` · **BE/AI 합의 전**

## 화면과 흐름

| 경로 | 화면 | M0 구현 범위 |
| --- | --- | --- |
| `#/profile` | 사용자 입력·수정 | 공통 입력 필드의 읽기 전용 와이어프레임 |
| `#/analysis` | 분석 시작 | 서버 분석 전 안내 및 Mock 결과 이동 |
| `#/results` | 결과 Dashboard | JSON 기반 카드, 상태 집계, 상태 필터 |
| `#/policies/:id` | 정책 상세 | 개별 조건, 이유, 근거, 향후 조건 충족일 |
| `#/questions` | 역질문 | 정책별 질문 및 답변 UI 예시 |
| `#/combinations` | 조합 | 검토 정책 및 충돌/추가확인 사유 |
| `#/schedule` | 서류·일정 | 정책별 서류, 발급처, 소요일, 준비·권장·마감일 |

예정 흐름: 조건 입력/수정 → 저장 → 분석 → 결과 → 상세 → 부족 정보 답변 → 재판정 → 조합 → 서류·일정.
M0에서는 화면 이동만 연결하며 저장·AI 분석·답변 제출·서류 체크는 수행하지 않는다.

공통 UI: header/navigation, heading, badge, card, 상태 필터, Loading/Error/Empty, 없는 경로 안내.
해시 라우팅으로 새로고침 및 뒤로/앞으로 이동을 지원한다. 외부 라이브러리 없이 ES modules로 구성했으며 기존 디자인 초안은 `prototype/index.html`에 보존한다.

## 판정 상태

| API 값 | UI 문구 | 표현 | 다음 행동 |
| --- | --- | --- | --- |
| PASS | 신청 가능 | 녹색·✓ | 근거 확인 후 준비 |
| FAIL | 조건 미충족 | 적색·× | 미충족 이유 확인 |
| UNKNOWN | 추가 확인 | 황색·? | 추가 질문 확인 |
| FUTURE_PASS | 향후 가능 | 청색·↗ | 예상 조건 충족일 확인 |

색상과 함께 텍스트·기호를 제공한다. FUTURE_PASS의 날짜를 접수 가능일로 표현하지 않는다. UNKNOWN을 임의로 PASS로 바꾸거나 확인 전 조합 총액을 확정하지 않는다.

## 데이터

공유 예시: [`../mocks/scenario.json`](../mocks/scenario.json).
`src/contracts.js`는 화면별 배열/객체 형태, 판정·조합 상태, 결과·질문·서류·일정·조합·충돌의 정책 참조, 조건 근거를 검증한다. FUTURE_PASS 날짜는 YYYY-MM-DD 형식과 실제 달력 날짜(윤년 포함)를 확인한다. 전체 API 응답용 필드 스키마 검증기는 M0 합의 후 확장한다.

- `UserProfile`: PRD snake_case 필드 사용. 소득은 원 단위 숫자, 알 수 없는 가구 소득은 `null` (0원과 구별). 날짜는 `YYYY-MM-DD`.
- `Policy`: `policy_id`, `name`, `organization`, `benefit`, `description`. 실제 원문·접수기간 등 필드는 BE와 추가 합의한다.
- `EligibilityResult`: `user_id`, `policy_id`, `status`, `reason`, `future_eligibility_date`, `conditions[]`.
- 조건: `name`, `status`, `reason`, `evidence: { quote, page, url }`. Mock URL은 `null`; 실제 서비스는 원문 링크를 제공해야 한다.
- `AIQuestion`: `question_id`, `policy_id`, `type`, `text`. `boolean/select/number/date`별 선택지·제약 및 답변 DTO는 M0에서 합의해야 한다.
- 조합: 정책 ID 목록, `compatibility`, `conflicts[]`. 충돌은 비교 정책 ID와 이유를 함께 반환한다.
- 서류: 정책 ID, 서류 ID, 이름, 필수 여부, 발급처, 예상 소요일.
- 일정: 정책 ID, 준비 시작일, 권장 신청일, 마감일.

이 데이터는 UI 검토용 가상 시나리오이며 실제 정책 정보나 AI 판정 결과가 아니다.

## API 제안 (아직 구현·확정되지 않음)

| 요청 | 용도 |
| --- | --- |
| `GET /api/profile` | 내 조건 조회 |
| `PUT /api/profile` | 조건 저장·수정 |
| `GET /api/policies` | 정책 조회 |
| `POST /api/analyses` | 분석 작업 생성 |
| `GET /api/analyses/:id` | 분석 진행 상태·결과 조회 |
| `GET /api/analyses/:id/policies/:policyId` | 판정 상세 |
| `GET /api/analyses/:id/questions` | 부족 정보 질문 |
| `POST /api/analyses/:id/answers` | 답변 및 재판정 요청 |
| `GET /api/analyses/:id/combination` | 조합·충돌 |
| `GET /api/analyses/:id/action-plan` | 서류·일정 |

성공 제안: `{ "data": ..., "request_id": "..." }`.
실패 제안: `{ "error": { "code": "...", "message": "...", "fields": {} }, "request_id": "..." }`와 적절한 HTTP 상태 코드.
분석 작업 상태 제안: `PENDING/RUNNING/SUCCEEDED/FAILED`; 자격 판정 상태와 별도 관리.

## M0 완료 전에 BE/AI와 확인할 항목

1. 위 필드 및 response/error envelope, 인증 방식, 서버 주소/CORS.
2. 비동기 분석의 ID, polling 방식, timeout, 재판정 version 및 기존 결과 무효화 기준.
3. 질문 네 종류별 입력 제약·답변 DTO와 `모름`의 표현.
4. 원문 URL/페이지/인용문 및 미래 날짜·판정 기준일 반환 규칙.
5. 동일 JSON으로 BE response 생성 및 AI parsing 결과 검증.

이 항목의 확인 없이 M0 전체 완료나 실제 API 연동 완료로 간주하지 않는다.
