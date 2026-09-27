# Backend 진행 점검 · 2026-09-21

## 확인 기준

GitHub 브랜치·PR·CI 로그와 해당 커밋의 코드/테스트를 직접 읽었다. 문서의 오래된 완료 수치를 그대로 사용하지 않았다. 이번 점검에서 BE 테스트를 로컬 재실행하거나 운영 DB, 온통청년 API, 유료 LLM을 호출하지 않았다.

| 브랜치 | 확인한 HEAD | 판단 |
| --- | --- | --- |
| dev | `002e7491e04afc1d0de26ff538329490a96d01d1` | 현재 통합된 BE 구현 기준 |
| main | `5a991da4721129894dafe88670bb6c0b2186f9f7` | 초기 README만 있음. 제품 진척 판단 기준으로 부적합 |
| ai/agents-a1-a2 | `8577ed3f8d5a1c63d8e5cf83dc280c9b26947dfd` | dev 대비 고유 8커밋, 뒤처짐 30커밋. 추가 정규화·교차검증·MCP 등은 미병합 |

[브랜치 비교](https://github.com/Claude-MCP-7team/BE/compare/002e7491e04afc1d0de26ff538329490a96d01d1...8577ed3f8d5a1c63d8e5cf83dc280c9b26947dfd). [A2 PR #1](https://github.com/Claude-MCP-7team/BE/pull/1)은 9/19 병합됐지만 이후 같은 AI 브랜치에 추가된 변경까지 병합된 것은 아니다.

## 검증 결과

[dev CI 35501247191](https://github.com/Claude-MCP-7team/BE/actions/runs/35501247191)의 test·docker·windows-cp949 작업 모두 성공했다.

- Linux: **658 passed / 1 skipped / 1 warning**. SDK가 설치되지 않은 환경을 검사하는 테스트는 SDK 설치 환경에서 skip하도록 작성돼 있다.
- Windows: **626 passed / 33 skipped / 2 warnings**. DB/배치 의존성이 없는 환경의 skip을 전체 기능 검증으로 세지 않는다.
- CI는 PostgreSQL 마이그레이션, DB 제약조건, DB 통합 검사, lint/mypy, 계약 JSON 드리프트, 엔진 벤치마크를 포함한다. Docker에서는 기동·판정·CORS 헤더·비루트 실행을 검사한다.

[CI 정의](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/.github/workflows/ci.yml), [SDK 조건부 테스트](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/tests/unit/test_llm_failure.py).

## 마일스톤 반영

M0~M4의 Backend 작업 **37개**를 체크했다. 체크는 개별 BE 작업의 검증 범위이며, 실제 사용자 화면까지 연결된 마일스톤 전체 완료를 뜻하지 않는다. FE/AI/Design 체크박스, P0 전체 흐름, M5 제출 시나리오 완료 표시는 이번에 변경하지 않았다.

| 단계 | 신규 체크 | 근거 및 범위 |
| --- | ---: | --- |
| M0 | 8 | 수집 클라이언트의 실제 호출 기록과 원문 URL/건수 조사, 공개 스키마와 에러 규격, FE용 응답 fixture, 병합된 A2 DTO 및 계약 검사 |
| M1 | 7 | CI DB 마이그레이션·세션 CRUD, 수집/정규화, 정책 목록·상세 API, 원문 URL 보존, A2 검증 후 JSON 스냅샷 저장, 고정 seed |
| M2 | 8 | 프로필-룰 매핑·기본 Rule·3상태·향후 충족일·근거, AI 응답 검증 및 실패 처리. 결과 영속 저장과 FE 통합은 제외 |
| M3 | 8 | 질문 큐, 세션 PUT으로 answers 저장, 동일 엔진 재판정, 정책 JSON의 충돌 보존, conflict graph와 조합 solver/API. 증분·판정 이력 관리는 제외 |
| M4 | 6 | 서류 마스터와 조회, 안전 버퍼/영업일 일정 역산, 계획 API, 오류 처리·로그, BE 내부 E2E |

근거 파일:

- M0/M1: [수집 클라이언트](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/batch/collect/client.py), [DB 마이그레이션](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/db/migrations/0001_init.sql), [세션 저장소](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/app/db/sessions.py), [FE 응답 fixture](https://github.com/Claude-MCP-7team/BE/tree/002e7491e04afc1d0de26ff538329490a96d01d1/data/demo/responses).
- M2/M3: [판정·질문·조합·계획 API](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/app/api/v1/judge.py), [엔진](https://github.com/Claude-MCP-7team/BE/tree/002e7491e04afc1d0de26ff538329490a96d01d1/app/engine), [조합 solver](https://github.com/Claude-MCP-7team/BE/tree/002e7491e04afc1d0de26ff538329490a96d01d1/app/solver).
- M4: [일정 역산](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/app/planner/backplan.py), [서류 마스터](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/data/documents/master_v2.csv), [E2E 시나리오 검사](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/tests/e2e/test_demo_scenarios.py), [엔드포인트 오류 검사](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/tests/unit/test_endpoint_sweep.py).

## 완료로 체크하지 않은 핵심 항목

1. **EligibilityResult 저장/API:** API는 있지만 `judgement_run` 테이블에 결과를 쓰는 실행 경로가 확인되지 않는다. 스키마 존재만으로 영속 저장을 완료 처리하지 않았다.
2. **증분 재판정:** API 주석에서 명시적으로 전체 재판정을 선택한다. 재판정 자체는 동작하지만 요구사항 문구의 증분 구현과는 다르다.
3. **이전/현재 판정 Version 관리:** snapshot_version·ETag·프로필 해시는 존재한다. 사용자별 이전 판정과 현재 판정의 이력 관리가 완성됐다는 근거는 없다.
4. **실제 FE 통합:** CI의 테스트용 origin CORS 검사는 배포 FE와의 통합 검증이 아니다. HANDOFF에는 FE 배포 주소/CORS 설정이 남은 조건으로 적혀 있다. 현재 운영 CORS 값을 이번에 실측하지 않았으므로 비어 있다고 확정하지 않는다.
5. **실 LLM Parsing 및 실제 정책 조합 데모:** 수동 구조화 5건을 실제 검증 파이프라인으로 통과시키는 테스트는 있으나 실제 LLM 호출 완료와는 다르다. 실제 공고 기반 상충 쌍 중 국토부 청년월세 정책이 만료되어 시나리오 5는 고정 합성 데이터로 검증한다. 제출용 실제 공고 조합은 보완이 필요하다.
6. **팀 전체 완료/M5:** BE 내부 테스트 통과만으로 입력부터 브라우저 신청 일정까지의 전체 E2E, 기능 동결, 최종 배포·제출 완료를 체크하지 않았다.

[수동 구조화 데이터의 제한](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/data/manual/README.md), [수동 응답 검증 테스트](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/tests/e2e/test_manual_a2.py), [인수인계 기록](https://github.com/Claude-MCP-7team/BE/blob/002e7491e04afc1d0de26ff538329490a96d01d1/docs/HANDOFF.md).
