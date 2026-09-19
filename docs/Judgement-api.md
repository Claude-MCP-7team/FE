# 판정 API 클라이언트 · M2 연결 준비

2026-09-19 확인한 BE `dev`의 [판정 API](https://github.com/Claude-MCP-7team/BE/blob/dev/app/api/v1/judge.py), [응답 스키마](https://github.com/Claude-MCP-7team/BE/blob/dev/app/schemas/judgement.py), [응답 생성 코드](https://github.com/Claude-MCP-7team/BE/blob/dev/app/engine/evaluate.py) 및 [Issue #2의 FE 수용 기준](https://github.com/Claude-MCP-7team/FE/issues/2)을 반영했습니다.

API 클라이언트와 응답 검증·화면용 변환 함수는 분석 화면·Dashboard·정책 상세에 연결되어 있습니다. `YPC_API_BASE`가 설정된 서버 모드에서만 실제 요청을 보내며, 설정이 없으면 기존 Mock 결과를 유지합니다. 실제 BE 통합 검증을 뜻하지는 않습니다.

## 요청

`src/judgement-api.js`의 `createJudgementApi().judge(profile, options)`는 `POST /v1/judge?include=all`을 한 번 호출합니다. BE 기본 응답은 부적격 정책을 생략하므로 `include=all`을 고정해 요약 건수와 전체 목록을 대조합니다. 별도 분석 ID·polling·자동 재시도는 만들지 않습니다.

### Dashboard 연결 시 응답량 검토 (PR #11 리뷰 반영)

현재 `include=all`은 전체 목록 검증을 위한 선택이며 모든 화면의 최종 요청 방식으로 확정한 것은 아닙니다. Dashboard 연결 PR에서 대표 정책 규모의 응답 바이트 수·요청 시간·렌더링 비용을 측정하고, 화면에 필요한 결과 범위에 따라 BE 기본 `include=default` 사용 여부를 결정합니다. 실제 응답량과 성능은 아직 측정하지 않았습니다.

`include=default`를 도입할 때는 다음을 함께 변경해야 합니다.

- 기본 응답은 부적격 상세를 생략해도 `summary.ineligible`에는 전체 부적격 건수를 포함합니다. 현재 검증기의 전체 목록/요약 일치 조건을 그대로 적용하면 정상 응답을 거부하므로 요청 모드별 검증이 필요합니다.
- 생략된 부적격 결과를 빈 결과나 부적격 0건으로 표시하지 않습니다. 부적격 필터·상세 진입에 필요한 판정 결과를 언제 조회할지도 정해야 합니다.
- 현재 `GET /v1/policies/{id}`는 공고 내용 조회이며 사용자 판정 상세를 반환하지 않습니다. 부적격 판정 상세를 대신 가져오는 API로 간주하지 않습니다.

실측과 화면 요구가 정해지기 전에는 요청 모드나 검증 조건을 변경하지 않습니다.

### 요청 옵션과 사용 예시

- 입력은 저장된 BE `UserProfile`의 `core/history/answers/consent` 문서입니다. FE 편집용 평면 draft는 거부합니다. core의 상세 입력 유효성은 기존 폼/BE가 검증합니다.
- 문서를 임의로 재조립하지 않아 `0`, `false`, `null`, 기존 답변과 숨겨진 필드를 유지합니다. 클라이언트가 데이터를 저장하거나 로그에 출력하지 않습니다.
- 옵션의 `sessionId`가 있으면 `X-Session-Id` 헤더를 전송합니다. 세션 저장소는 호출자가 관리하며 판정 실패로 세션을 삭제하지 않습니다. 응답 `session_id`가 요청과 다르면 거부합니다. 익명 요청의 기대 응답은 `anonymous`입니다.
- 기본 제한 시간은 15초이며 응답 본문 수신까지 포함합니다. `timeoutMs`로 조정할 수 있습니다. `signal`로 취소할 수 있고, 제한 시간/취소 시 내부 fetch도 중단합니다.
- 조건값을 담은 요청은 `cache: 'no-store'`를 사용합니다. ETag 캐시는 구현하지 않았으며 304를 성공 결과로 취급하지 않습니다.

화면 연결 흐름:

```js
import { apiBase } from './runtime-config.js';
import { createProfileApi } from './profile-api.js';
import { createJudgementApi } from './judgement-api.js';
import { toJudgementView } from './judgement-contract.js';

// 분석 화면의 버튼에서 실행합니다. 설정이 없으면 서버 호출을 시작하지 않습니다.
if (apiBase === null) throw new Error('API 주소 설정이 필요합니다.');
const profiles = createProfileApi({ baseUrl: apiBase });
const profile = await profiles.get();
if (!profile) throw new Error('조건을 먼저 저장해 주세요.');
const controller = new AbortController();
const data = await createJudgementApi({ baseUrl: apiBase }).judge(profile, {
  sessionId: profiles.sessionId,
  signal: controller.signal,
});
const view = toJudgementView(data); // Dashboard와 정책 상세에 전달
// 화면 이탈 시 controller.abort(), 화면 출력은 HTML escape를 적용합니다.
```

## 검증과 화면 변환

`validateJudgementResponse()`는 정책 ID 중복, 지원하지 않는 verdict/confidence, 조건 배열의 형태, 배열 간 중복 rule_id, 빈 원문 근거, 조건값 타입, 실제 달력 날짜, 미래 날짜와 영구 불충족의 모순, 요약 건수와 목록의 불일치를 거부합니다. `ESTIMATED`/`NEEDS_REVIEW`는 담당부서명·연락처·원문 URL을 요구합니다. 원문 링크는 null 또는 HTTP(S) URL만 허용합니다. 현재 BE가 직렬화하는 세 조건 배열·세 요약 건수·면책 문구가 모두 있어야 통과합니다.

빈 결과는 요약 건수도 모두 0일 때 허용합니다. 원문 링크가 null인 것과 원문 인용문이 없는 것은 다르게 처리합니다. 링크 부재는 허용하지만 근거 인용문 부재는 거부합니다. 알려지지 않은 추가 필드는 유지해 선택적 확장과 공존할 수 있습니다.

`toJudgementView()`는 검증 후 문서를 복제하고 각 정책에 `conditions[]`를 추가합니다. 배열별 순서를 보존해 matched → unmatched → unknown 순서로 묶습니다. 공고문 전체 순서를 추정해 재정렬하지 않습니다.

| 응답 위치 | 조건 표시 status |
| --- | --- |
| matched | PASS |
| unmatched + satisfiable_from 있음 | FUTURE_PASS |
| unmatched + satisfiable_from 없음 | FAIL |
| unknown | UNKNOWN |

`evidence.quote`는 `source_quote`, `evidence.url`은 조건의 `source_url` 또는 정책의 `origin_url`을 사용합니다. 둘 다 없으면 null로 유지합니다. 조건의 `permanently_unsatisfiable`과 개별 날짜, 정책의 verdict/confidence/담당부서/면책 문구를 보존합니다. 정책 수준 status·future_eligibility_date나 추가 질문을 생성하지 않습니다. 조건에 미래 날짜가 있어도 정책이 INELIGIBLE이면 그대로입니다. 문자열은 HTML이 아니며 실제 화면 연결 시 이스케이프가 필요합니다.

`satisfiable_from`은 달력상 유효한 날짜인지와 영구 불충족 표시와의 모순만 검사합니다. 브라우저의 오늘보다 미래인지 비교하지 않습니다. BE는 KST 기준일 또는 테스트용 고정 기준일로 날짜를 계산하며 현재 판정 응답에는 기준일 필드가 없으므로, 클라이언트 시각을 근거로 정상 응답을 거부하거나 재판정하지 않습니다.

## 오류와 검증 범위

| code | 의미 |
| --- | --- |
| INVALID_PROFILE | BE core 문서가 아닌 입력 |
| NETWORK_ERROR | 연결 또는 본문 수신 실패 |
| HTTP_ERROR | 422/503 등 HTTP 실패, status/detail 보존 |
| INVALID_RESPONSE | JSON·응답 계약·세션 불일치 |
| REQUEST_TIMEOUT | 요청 제한 시간 초과 |
| REQUEST_CANCELLED | 호출자 취소 |

`tests/fixtures/judgement.json`은 BE 응답 구조에 맞춰 작성한 **가상 테스트 데이터**이며 실제 정책/실제 서버 응답이 아닙니다. 테스트는 조건 4상태, 신뢰도 구분, 오류 및 취소/시간 초과, 임시 로컬 HTTP 서버 요청·응답, Dashboard·상세 HTML 변환을 확인합니다. 실제 BE 주소/CORS와 브라우저 통합 검증, 결과 갱신·이전 결과 무효화는 후속 작업입니다.
