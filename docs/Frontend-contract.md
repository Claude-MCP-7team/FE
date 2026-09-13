# Frontend MVP 인터페이스 계약 초안

갱신일: 2026-09-13 · Final MVP PRD / Milestone v3 반영 · **BE/AI 합의 전**

범위: M0에서 합의할 MVP 전체 인터페이스(입력·판정·근거·질문·조합·서류·일정)를 다룬다. M0 구현 현황은 아래 기존 Mock 설명과 구분하며, 문서에 포함됐다는 이유로 해당 기능 구현이나 계약 합의가 완료된 것은 아니다.

## 새 PRD와 기존 구현의 차이

현재 `mocks/scenario.json`과 `src/contracts.js`는 이전 `0.1-draft` 계약의 실행 예시다. 아래 새 계약과 동일한 응답으로 간주하지 않는다. Issue #2에서 합의 후 별도 기능 브랜치에서 전환하며, 이번 문서 갱신으로 서버 DTO를 확정하지 않는다.

AI는 공고문 구조화·질문·설명을, BE는 최종 판정·미래 날짜·조합·지원금 합산·일정 계산을 담당한다. FE는 BE 응답을 표시하며 판정 비즈니스 로직을 구현하지 않는다.

| 구분 | 새 PRD 계약 | 이전 Mock |
| --- | --- | --- |
| 정책 판정 | `JudgementResult.verdict`: ELIGIBLE / INELIGIBLE / NEEDS_INFO | `EligibilityResult.status`: PASS / FAIL / UNKNOWN / FUTURE_PASS |
| 조건 판정 | PASS / FAIL / UNKNOWN / FUTURE_PASS | 조건별 status 사용 |
| 조건 결과 컨테이너 | matched[] / unmatched[] / unknown[]; FUTURE_PASS 배치 미정 | conditions[] 평면 배열의 status |
| 신뢰도 | CONFIRMED / ESTIMATED / NEEDS_REVIEW, verdict와 분리 | 미구현 |
| 근거 | source_quote / source_url / confidence | evidence.quote / page / url |
| 개인 소득 | personal_income | income |
| 추가 Profile 필드 | employment_type / household_size / received_policy_ids | 일부 미포함 |

### 반드시 합의할 표현 규칙

- 정책 verdict는 3개지만 Dashboard는 향후 가능을 포함한 4개 분류다. 미래 날짜 존재만으로 FE가 신청 가능 여부를 재판정하지 않는다. BE가 반환할 표시 필드 또는 합의된 표현 규칙이 필요하다.
- NEEDS_INFO(사용자 정보 부족)와 NEEDS_REVIEW(근거·공고문 추가 검토)를 구분한다. ESTIMATED를 확정 판정·확정 충돌로 표시하지 않는다.
- 날짜는 BE가 계산한다. FE의 생년월일·거주 시작일 입력 검증은 자격 판정과 별개다.
- PRD 예제의 `op`와 Condition 필드 목록의 `operator`, Milestone의 `sourceQuote`와 PRD의 `source_quote` 표기를 하나로 확정해야 한다.
- `Condition.confidence`의 타입과 결과 신뢰도 enum의 관계를 확정해야 한다.

#### 조건 상태 4개와 응답 배열 3개의 대응

[PRD](PRD.md) 13장은 조건 상태를 PASS / FAIL / UNKNOWN / FUTURE_PASS로 정의하지만, 20장의 JudgementResult에는 matched[] / unmatched[] / unknown[]만 있다. 정책 verdict와 Dashboard 분류 문제와는 별개의 조건 상세 계약 누락이다.

BE·AI와 다음을 합의한다.

- FUTURE_PASS 조건을 기존 세 배열 중 어디에 넣는지, 별도 배열을 추가하는지, 또는 status를 가진 단일 배열로 반환하는지 확정한다. 어느 방식도 현재 합의된 것으로 간주하지 않는다.
- 각 배열 원소가 조건 객체인지 rule_id 참조인지, 조건별 status·원문 근거·예상 충족일을 어디에서 읽는지 확정한다. 정책 전체의 future_eligibility_date와 개별 조건 날짜도 구분한다.
- 여러 배열에 같은 rule_id가 나타날 수 있는지, 조건의 누락·중복·표시 순서를 어떻게 처리할지 합의한다.

현재 `src/app.js`의 `detail()`은 `result.conditions[]`와 각 원소의 status를 읽는다. 합의 후 별도 정책 상세 기능 PR에서 응답 변환과 검증기를 수정한다. FE가 배열 이름이나 정책 미래 날짜만으로 조건 상태를 추측하지 않는다.

확인 기준: 네 가지 조건 상태를 모두 담은 BE 응답 예시에서 FUTURE_PASS 조건의 위치·상태·근거·개별 날짜를 모호함 없이 확인하고, FE 상세 화면에 빠짐없이 표시할 수 있어야 한다.

#### Condition.askable 의미와 질문 노출 책임

[PRD](PRD.md) 20장은 askable을 필드로 열거하지만 의미·타입·사용 규칙을 정의하지 않는다. 이름만으로 “역질문 대상 여부”라고 확정하지 않고 BE·AI에 다음을 확인한다.

- 의미, 자료형, 필수 여부 및 누락/null의 처리 규칙은 무엇인가?
- 값은 AI 구조화 단계와 BE 판정 단계 중 어디에서 생성·검증하며, 사용자에게 부족한 정보와 공고문 자체의 모호함을 어떻게 구분하는가?
- UNKNOWN과 askable의 조합이 질문 생성·보류·추가 검토로 어떻게 연결되는가? boolean으로 합의하는 경우 true/false 각각의 동작도 명시한다.
- FE가 최종 질문 API 목록만 표시하는지, askable을 직접 읽는 역할도 있는지 확정한다. 현재 FE는 questions[]를 표시하며 askable로 질문을 생성하거나 필터링하지 않는다.
- 질문과 rule_id/policy_id의 연결, 여러 조건의 질문 병합, 모르겠음/건너뛰기 후 재질문 규칙을 확정한다.

확인 기준: 합의된 타입의 askable 값과 누락 사례, UNKNOWN 및 NEEDS_REVIEW 사례별 질문 API 응답·노출 여부가 설명된 예시를 받는다. FE가 askable만 보고 질문 내용이나 최종 자격을 임의로 만들지 않는다.

### M1 Profile 입력 초안

PRD 필드: birth_date, region, residence_start_date, education, employment_status, employment_type, personal_income, household_income, household_size, marital_status, policy_history, received_policy_ids, answers.

폼 우선 구현에서는 생년월일·거주지역·거주 시작일을 필수 입력으로 제안하고, 소득·가구원 수 등 모르는 값은 null로 둔다. 이름·주민등록번호·상세주소는 수집하지 않는다. enum·필수 여부·소득의 월/연 기준은 BE 확인 전이며, 선택지/검증은 FE 편집용 초안이지 서버 계약이 아니다. received_policy_ids와 answers는 정책/질문 API가 준비된 뒤 선택 UI로 연결한다.

### FE 개발 브랜치 운영

아래는 이 FE 저장소에 적용하는 운영 규칙이다. Milestone에 명시된 팀 전체 컨벤션이나 BE·AI 저장소의 브랜치 규칙을 새로 확정하는 내용은 아니다.

`docs/mvp-contract-alignment`, `feat/profile-form`, `feat/profile-api`, `feat/analysis-flow`, `feat/judgement-dashboard`, `feat/policy-detail`처럼 작업별로 최신 dev에서 분기하고 PR 대상은 dev로 지정한다. 독립 작업은 별도 PR로, 선행 코드에 의존하는 작업은 선행 PR 머지 후 시작한다.

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

## 기존 Mock 판정 상태 (새 정책 verdict로 전환 전)

| API 값 | UI 문구 | 표현 | 다음 행동 |
| --- | --- | --- | --- |
| PASS | 신청 가능 | 녹색·✓ | 근거 확인 후 준비 |
| FAIL | 조건 미충족 | 적색·× | 미충족 이유 확인 |
| UNKNOWN | 추가 확인 | 황색·? | 추가 질문 확인 |
| FUTURE_PASS | 향후 가능 | 청색·↗ | 예상 조건 충족일 확인 |

색상과 함께 텍스트·기호를 제공한다. FUTURE_PASS의 날짜를 접수 가능일로 표현하지 않는다. UNKNOWN을 임의로 PASS로 바꾸거나 확인 전 조합 총액을 확정하지 않는다.

## 기존 Mock 데이터 (0.1-draft)

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
6. 조건 4개 상태와 matched/unmatched/unknown 배열의 대응, FUTURE_PASS 조건 위치·근거·개별 날짜 및 상세 화면 변환 규칙.
7. askable의 의미·타입·생성 주체·누락 처리와 UNKNOWN/NEEDS_REVIEW별 질문 생성·노출 책임.

이 항목의 확인 없이 M0 전체 완료나 실제 API 연동 완료로 간주하지 않는다.
