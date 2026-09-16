<aside>
📌

**문서 목적**: PRD v1.0의 사용자 경험·서비스 구조와 PRD v2.0의 실제 개발 아키텍처·안전장치를 통합한 2026년 10월 1일 제출 기준 최종 PRD.

</aside>

## 0. 문서 정보

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | 개발·경진대회 제출용 Final MVP |
| 제품 코드명 | YouthPolicy Coordinator (YPC) |
| 서비스 가칭 | 청년서랍 |
| 개발 기준일 | 2026-09-04 |
| 제출일 | **2026-10-01** |
| 1차 범위 | 경기도 / 용인시 / 중앙부처 일부 정책 |
| 플랫폼 | 반응형 Web |

## 1. 한 문장 정의

> 청년정책을 단순히 찾아주는 서비스가 아니라, **실제 공고문과 사용자의 조건을 비교하여 신청 가능 여부를 판정하고, 그 이유와 향후 가능 시점, 함께 받을 수 있는 정책 조합, 필요한 서류와 신청 준비 일정까지 제공하는 AI 정책 코디네이터 서비스**.
> 

## 2. PRD 통합 원칙

### 2.1 v1.0에서 유지

- 서비스 핵심 가치와 사용자 Flow
- 공통정보 입력 후 부족한 조건만 AI 역질문
- 결과 Dashboard / 정책 상세 / 역질문 / 조합 / 신청 일정 UX
- FUTURE_PASS와 대안 정책 개념
- 부적격을 Dead End로 만들지 않는 UX
- 모든 판정에 공고문 근거를 연결하는 원칙
- 경진대회 Demo Scenario

### 2.2 v1.0에서 삭제·변경

- Eligibility Agent가 최종 PASS/FAIL을 직접 결정하는 구조 삭제
- Optimization Agent가 직접 조합을 계산하는 구조 삭제
- Schedule Agent가 직접 날짜를 계산하는 구조 삭제
- 같은 종류의 Judge Agent 2개가 모든 판정을 반복하는 구조 축소

### 2.3 v2.0에서 유지

- Batch / Realtime 분리
- `PolicySchema` 중심의 AI↔Backend 계약
- 결정론적 Rule Engine
- `source_quote`, `source_url`, `confidence` 기반 근거 관리
- `ELIGIBLE / INELIGIBLE / NEEDS_INFO` 정책 단위 판정
- `CONFIRMED / ESTIMATED / NEEDS_REVIEW` 신뢰도 분리
- 코드 기반 조합 계산 및 일정 계산
- 원문 근거 없는 확정 판정 금지
- 개인정보 최소 수집 및 면책 고지

### 2.4 v2.0에서 Post-MVP로 축소

- 200건 Golden Set
- Precision 92% 제출 Gate
- 500건/시간 배치 KPI
- n=20 사용자 테스트
- 전국 정책 확대
- 관리자 검증 Queue 완성형
- 고급 MWIS/ILP 최적화
- Email/알림톡 자동 알림
- 캘린더 Export
- 서류 Master 30~50종 전체 구축
- pgvector/Redis/Airflow 운영 고도화

<aside>
🧭

**최종 방향**: 사용자 경험은 v1.0처럼 이해하기 쉽게, 내부 구조는 v2.0처럼 결정론적이고 검증 가능하게 구현한다.

</aside>

## 3. 프로젝트 배경

기존 청년정책 서비스는 정책 검색과 추천은 제공하지만 실제 사용자가 알고 싶은 **왜 가능한지, 왜 불가능한지, 언제 가능해지는지, 무엇을 함께 받을 수 있는지, 무엇을 언제 준비해야 하는지**까지 충분히 연결하지 못한다.

실제 온통청년 자가진단 사례에서는 7개 자격조건 중 6개를 충족했음에도 하나의 조건 때문에 최종 결과가 `부적격`으로 종료되었다. 사용자는 결과보다 다음 행동이 필요하다.

기존 구조:

```
정책 검색 → 상세페이지 → 개별 자격 확인
```

본 서비스:

```
조건 입력 → 일괄 판정 → 부족 정보 질문 → 판정 근거 → 정책 조합 → 신청 준비 계획
```

## 4. 문제 정의

### P1. 판정 결과만 있고 다음 행동이 없다

- 어떤 조건 때문에 부적격인지 알기 어렵다.
- 다른 조건은 충족했는지 알기 어렵다.
- 언제 조건이 충족되는지 알기 어렵다.
- 지금 대신 신청 가능한 정책으로 연결되지 않는다.

### P2. 정책을 하나씩 직접 비교해야 한다

- 많은 정책을 사용자가 직접 검색해야 한다.
- 정책별 중복수혜 제한을 공고문에서 수동 비교해야 한다.

### P3. 고정 필터로 표현하기 어려운 조건이 많다

예: `6개월 이상 계속 거주`, `부모 합산 소득`, `최근 2년 내 유사사업 미참여`, `과거 지원 횟수`, `결혼신고일` 등.

따라서 초기 입력은 공통조건만 수집하고, 정책별로 부족한 정보는 AI 역질문으로 보완한다.

## 5. Product Goal

> **Find → Judge → Explain → Ask → Optimize → Plan**
> 

즉:

```
찾아주기
→ 판정하기
→ 이유 설명하기
→ 부족하면 되묻기
→ 함께 받을 정책 계산하기
→ 실제 신청계획 만들기
```

사용자는 최종적으로 다음 질문에 답을 얻어야 한다.

1. 나는 어떤 정책을 받을 수 있는가?
2. 왜 받을 수 있는가?
3. 왜 받을 수 없는가?
4. 지금 안 된다면 언제 가능해지는가?
5. 동시에 받을 수 있는 정책은 무엇인가?
6. 무엇을 준비해야 하는가?
7. 언제부터 준비해야 하는가?

## 6. 핵심 사용자

- **탐색 피로형**: “정책이 너무 많아서 무엇을 봐야 하는지 모르겠다.”
- **부적격 좌절형**: “부적격이라고 하는데 왜 안 되는지 모르겠다.”
- **최적화 추구형**: “여러 정책 중 무엇을 함께 받는 게 가장 유리한지 모르겠다.”

## 7. MVP 성공 기준

```
사용자 기본조건 입력
→ 정책 조회
→ 공고문 구조화
→ Rule Engine 자격 판정
→ 정보 부족 시 AI 역질문
→ 사용자 답변
→ 재판정
→ 판정 이유 + 공고문 근거
→ 향후 가능 시점
→ 중복수혜 Conflict 분석
→ 정책 조합 계산
→ 필요서류
→ 신청 일정
```

## 8. MVP 범위

### P0 — 반드시 구현

- 사용자 조건 입력 및 수정
- 실제 정책 데이터 조회
- 실제 공고문 최소 3~5건 Parsing
- `PolicySchema` 구조화
- Rule Engine 기반 판정
- `PASS / FAIL / UNKNOWN / FUTURE_PASS`
- 판정 이유 및 공고문 근거
- AI 역질문 및 답변 후 재판정
- 미래 조건 충족 시점 계산
- 최소 2개 정책 중복수혜 Conflict 분석
- 최소 1개 추천 정책 조합
- 필요서류 및 신청 Timeline

### P1 — 시간 여유 시

- 대안 정책 추천 고도화
- 고급 검색·필터
- 정책 범위 확대
- 보수/최대 조합 비교
- 복수 추천 조합
- 고급 Solver
- 관리자 검증 화면
- 알림·캘린더
- 통계 Dashboard
- 세부 Animation

## 9. Non-Goals

- 전국 3,000개 정책 완전 지원
- 정책 자동신청
- 정부24 서류 자동발급
- 공공 MyData 실제 연동
- 금융 계좌·자산 연동
- 담당기관 자동 문의
- Native App
- AI가 최종 법적 자격을 보증하는 기능

<aside>
⚠️

본 서비스는 자격 **검증(verification)** 서비스가 아니라, 공고문 기반 **판정 근거 설명(explanation)** 서비스다. 최종 자격 확인 책임은 공식 공고 및 담당기관에 있다.

</aside>

## 10. 역할 분리 원칙

### AI

- 비정형 공고문 이해
- 자연어 → 구조화 데이터 변환
- 애매 조건 탐지
- 역질문 생성
- 사용자 친화 설명 생성
- 중복수혜 문구 추출

### Backend

- 조건 비교
- PASS / FAIL 결정
- FUTURE_PASS 날짜 계산
- 재판정
- Conflict 적용
- 조합 계산
- 지원금 합산
- 신청 일정 계산

### Frontend

- 사용자 입력
- 판정 상태 표현
- 근거 표현
- AI 역질문 UX
- 조합 결과
- 서류 Checklist
- 신청 Timeline

> **핵심 원칙: AI는 의미를 이해하고, 코드는 결정을 계산한다.**
> 

## 11. 시스템 아키텍처

### 11.1 Offline / Batch

```
온통청년 OPEN API
+ 공공데이터
+ 실제 공고문
        ↓
공고문 Text 추출
        ↓
A1 Parsing Agent
        ↓
A2 Structuring Agent
        ↓
PolicySchema
        ↓
Database
```

### 11.2 Online / Realtime

```
UserProfile
    ↓
Candidate Policies
    ↓
Rule Engine
    ↓
ELIGIBLE / INELIGIBLE / NEEDS_INFO
    ↓
UNKNOWN 존재 시 AI Question
    ↓
사용자 Answer
    ↓
Incremental Re-Judge
    ↓
Result
```

## 12. AI 구성

### A1. Parsing Agent

추출 대상:

- 자격조건
- 제외조건
- 필요서류
- 신청기간
- 중복수혜 문구
- 지원내용
- 담당기관
- 원문 근거

### A2. Structuring Agent

자연어 조건을 `PolicySchema`로 변환한다.

예:

```
“신청일 기준 용인시에 6개월 이상 계속 거주”
```

```json
{
  "field": "residence_months_continuous",
  "op": ">=",
  "value": 6,
  "unit": "months",
  "time_satisfiable": true
}
```

### C1. Question Agent

- `UNKNOWN` 발생 원인을 기준으로 필요한 정보만 질문
- 동일 정보로 여러 정책이 해결되면 질문 병합
- 가급적 예/아니오, 선택형, 숫자, 날짜 형태 사용

### C2. Explanation Agent

Rule Engine이 확정한 결과를 사용자 친화 문장으로 설명한다. AI가 verdict 자체를 변경하지 않는다.

## 13. 자격 판정 Engine

### 조건 단위 상태

- `PASS`
- `FAIL`
- `UNKNOWN`
- `FUTURE_PASS`

### 정책 단위 상태

- `ELIGIBLE`
- `INELIGIBLE`
- `NEEDS_INFO`

### 신뢰도

- `CONFIRMED`
- `ESTIMATED`
- `NEEDS_REVIEW`

판정 상태와 신뢰도는 분리하여 관리한다.

## 14. FUTURE_PASS

시간 경과만으로 계산 가능한 조건만 미래 충족일을 산출한다.

- 연령 하한
- 연속 거주기간
- 재직기간
- 졸업 후 기간
- 정책 참여 종료 이후 경과기간

소득, 취업상태처럼 미래 변화가 불확실한 값은 FUTURE_PASS로 추측하지 않는다.

## 15. Explainable Eligibility

모든 판정은 공고문 근거와 연결되어야 한다.

| 조건 | 나의 상태 | 결과 |
| --- | --- | --- |
| 나이 | 24세 | PASS |
| 지역 | 용인시 | PASS |
| 학력 | 대학생 | PASS |
| 취업 | 미취업 | PASS |
| 거주기간 | 4개월 / 6개월 필요 | FAIL |

각 조건에는 `source_quote`, `source_url`, `confidence`를 연결한다. 근거가 없으면 확정 판정을 만들지 않는다.

## 16. 중복수혜 분석

AI는 공고문에서 중복수혜 제한 관계를 추출하고 Backend는 이를 Conflict로 적용한다.

Conflict 상태:

- `CONFIRMED`
- `ESTIMATED`
- `NEEDS_REVIEW`

`ESTIMATED`는 자동으로 확정 배제하지 않고 사용자에게 담당기관 확인을 권장한다.

## 17. 정책 조합 최적화

LLM이 직접 조합 계산을 수행하지 않는다.

MVP에서는 소규모 정책 집합에 대해 결정론적으로 계산한다.

```
A = 300만원
B = 200만원
C = 100만원

A-B = Conflict
A-C = Compatible
B-C = Compatible

가능 조합
A = 300
B = 200
C = 100
A+C = 400
B+C = 300

추천 → A+C / 400만원
```

MVP 최적화 기준은 **총 추정 혜택 최대화**로 고정한다.

## 18. 필요서류

공고문 Parsing으로 서류를 추출한다.

```
name
issuer
estimated_lead_time
required
source_quote
```

예: 주민등록초본, 건강보험료 납부확인서, 소득금액증명원, 재학증명서.

## 19. 신청 일정 계산

신청 일정은 AI가 아니라 코드가 계산한다.

```
권장 준비 시작일
= 신청 마감일 - 최대 서류 준비기간 - 안전 Buffer
```

예:

```
9/24 서류 준비 시작
↓
9/27 서류 최종 확인
↓
9/28 온라인 신청 권장
↓
9/30 신청 마감
```

## 20. Data Model

### UserProfile

```
birth_date
region
residence_start_date
education
employment_status
employment_type
personal_income
household_income
household_size
marital_status
policy_history
received_policy_ids
answers
```

### PolicySchema

```
policy_id
source
meta
benefit
application_period
eligibility[]
exclusions[]
conflicts[]
documents[]
quality
```

### Condition

```
rule_id
field
operator
value
unit
time_satisfiable
source_quote
source_url
confidence
askable
```

### JudgementResult

```
policy_id
verdict
confidence
matched[]
unmatched[]
unknown[]
future_eligibility_date
explanation
```

### PolicyCombination

```
policy_ids
total_benefit
conflicts[]
excluded_policies[]
recommendation_reason
```

## 21. 화면 구성

1. **S1. Landing / Service Introduction** — 서비스 가치 설명
2. **S2. User Condition Input** — 공통조건 입력
3. **S3. AI Analysis** — 정책 조회·조건 비교 진행 상태
4. **S4. Result Dashboard** — 신청 가능 / 향후 가능 / 추가 확인 / 신청 불가
5. **S5. Policy Detail** — 조건별 판정·근거·원문·미래 가능일·서류
6. **S6. AI Question** — 부족정보 역질문
7. **S7. Policy Combination** — 추천 조합·총 혜택·Conflict·추천 이유
8. **S8. Application Plan** — 필요서류·준비 시작일·권장 신청일·마감일

## 22. UX 원칙

1. **AI 결과보다 공고문 근거를 먼저 신뢰하게 한다.**
2. **부적격을 Dead End로 만들지 않는다.**
3. **모르면 추측하지 않는다.**
4. **정보가 부족하면 질문한다.**
5. **모든 결과에는 다음 행동을 제공한다.**

## 23. AI Safety / Hallucination Control

AI가 임의 생성하면 안 되는 정보:

- 지원금액
- 신청기간
- 자격조건
- 제외조건
- 중복수혜조건
- 필요서류
- 담당기관 정보

핵심 정보에는 반드시 다음을 포함한다.

```
source_quote
source_url
confidence
```

- 정보 부족 → `NEEDS_INFO`
- 공고문 자체가 모호 → `NEEDS_REVIEW`

## 24. 개인정보 원칙

- 판정에 불필요한 개인정보 미수집
- 주민등록번호 미수집
- 상세주소 미수집
- LLM에 직접 개인 식별정보 미전송
- 정책 판정에 필요한 조건값만 사용

## 25. 제출 성공 지표

### 필수

- 실제 공고문 3~5건 구조화 성공
- 핵심 조건에 `source_quote` 존재
- 대표 Demo 판정 결과 수동 검증 일치
- UNKNOWN → 역질문 → 재판정 성공
- FUTURE_PASS 날짜 계산 성공
- 2개 이상 정책 Conflict 비교 성공
- 추천 조합 1개 이상 산출
- 신청 Timeline 생성 성공
- 전체 E2E 반복 실행 가능
- 치명적 오류 0건

### 가능하면 추가 측정

- 테스트 정책 10~20건 판정 정확도
- Parsing 필드 추출 성공률
- 근거 연결률

## 26. Demo Scenario

### 사용자

```
24세
용인시
연속 거주 4개월
대학생
미취업
```

### Scenario

1. 정책 A는 현재 신청 불가: 6개월 연속 거주 필요, 현재 4개월 → 향후 충족일 제시
2. 정책 B는 추가 확인 필요: 최근 2년 유사사업 참여 여부 역질문
3. 사용자가 `없음` 응답 → 재판정 → 신청 가능
4. 신청 가능 정책 A/B/C의 중복수혜 관계 분석
5. `A+B 불가`, `A+C 가능`, `B+C 가능`
6. 추천 조합과 예상 혜택 표시
7. 필요서류와 신청 일정 Timeline 제공

## 27. 개발 일정

| 단계 | 기간 | 핵심 완료 기준 |
| --- | --- | --- |
| M0 계약·데이터 검증 | 9/4~9/6 | Schema/API/Flow 확정 |
| M1 기반 구현 | 9/7~9/11 | 사용자 저장 + 실제 정책 Parsing |
| M2 판정 MVP | 9/12~9/17 | 입력 → 판정 → 근거 화면 E2E |
| M3 역질문·조합 | 9/18~9/22 | 질문 → 재판정 + Conflict → 조합 |
| M4 신청 행동 연결 | 9/23~9/26 | 서류·Timeline까지 연결 |
| M5 제출 안정화 | 9/27~10/1 | 신규 기능 동결 + E2E + 제출 |

<aside>
🚨

**9월 27일부터 신규 P0 기능 추가 금지.** 이후에는 회귀 테스트, 치명 버그 수정, 데모 안정화와 제출 준비만 수행한다.

</aside>

## 28. 일정 지연 시 Cut 순서

1. 지역/정책 범위 확대
2. 고급 검색·필터
3. 조합 복수안
4. 고급 Solver
5. 관리자 화면
6. 알림·캘린더
7. 부가 통계
8. 애니메이션

### 절대 제거하지 않는 핵심 흐름

```
공고문
→ 구조화
→ 자격 판정
→ 근거
→ 역질문
→ 재판정
→ 중복수혜
→ 추천 조합
→ 서류·일정
```

## 29. 최종 차별점

| 기존 정책 서비스 | 청년서랍 / YPC |
| --- | --- |
| 정책을 찾아줌 | 실제 사용자 조건으로 판정 |
| 적격/부적격 위주 | 조건별 이유와 공고문 근거 제공 |
| 현재 상태 위주 | 미래 가능 시점 계산 |
| 확인불가에서 종료 | AI가 추가 질문 |
| 정책을 독립적으로 추천 | 중복수혜 교차분석 |
| 정책 목록 제공 | 정책 조합 추천 |
| 필요서류 나열 | 신청 준비 Timeline 제공 |

## 30. 최종 핵심 메시지

> **기존 서비스가 “어떤 정책이 있는가”를 찾아주는 서비스라면, 청년서랍은 “내가 실제로 무엇을 받을 수 있고, 왜 그런지, 무엇을 함께 받아야 유리하며, 지금부터 무엇을 준비해야 하는지”까지 판단해주는 AI 정책 코디네이터다.**
>