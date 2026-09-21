# FE 배포 준비 및 실제 API 점검

## 2026-09-21 확인 결과

배포용 정적 파일을 `dist/`에 생성하고 로컬 `/FE/` 하위 경로에서 실제 Chrome으로 검사했다. **공개 배포는 아직 하지 않았다.** 배포 서비스와 최종 origin은 미확정이다.

운영 BE 주소는 `https://be-27y9.onrender.com`이며, 이번 점검은 가상 테스트 프로필로 수행했다. Node에서 FE의 실제 API 클라이언트/검증기를 사용한 결과와 브라우저 결과를 구분한다.

| 검사 | 결과 |
| --- | --- |
| `/healthz`, `/readyz` | HTTP 200. 정책 5건, 룰 13개. DB configured=false / ready=false |
| 정책 목록 | 데모 정책 5건. 실공고 운영 데이터로 간주하지 않음 |
| 판정 | FE 응답 검증 통과. eligible 2 / ineligible 2 / needs_info 1 / future_eligible 1 |
| 질문 | boolean 질문 1건. `similar_program_participation_2y` |
| 답변 후 재판정 | false 답변을 보내 eligible 3 / needs_info 0. 세션 저장 없이 프로필을 직접 보내 검사 |
| 조합 | 실제 API 클라이언트와 응답 검증 통과 |
| 신청 계획 | 일정 3건, 서류 8건. 실제 응답 검증 통과 |
| 세션 생성·저장 | HTTP 503, `session-store-unavailable`. 생성되지 않아 CRUD 후속 검증 불가 |
| CORS preflight | `http://127.0.0.1:5173` origin의 POST/Content-Type/X-Session-Id 요청: HTTP 405, allow-origin 없음 |
| Chrome에서 직접 API 호출 | `/FE/` 배포 미리보기 페이지에서 Failed to fetch. 서버 간 통신 성공을 브라우저 연동 성공으로 간주하지 않음 |

확인 시각: 2026-09-21 16:20 KST. 스냅샷: `20260921T0719Z-5p-3a825958c00e`. 상세 실행 결과는 [API 점검 기록](verification/api-2026-09-21.json)에 보관한다.

## 이번에 수정한 FE 문제

- 답변 폼을 disabled 처리한 뒤 FormData를 생성하여 답변이 빠지던 문제: 답변을 먼저 읽고 검증한 뒤 비활성화한다. 기존 답변은 보존한다.
- API 모드에서 분석 전/새로고침 후 Mock 결과가 표시되던 문제: 입력/분석 안내를 표시하고 예시 정책 파일을 요청하지 않는다.
- 프로필 저장 후 분석 화면으로 이동하며, 저장/삭제 시 메모리의 이전 판정 결과를 비운다. 결과 화면에서 조건 수정·재분석·추가 질문으로 이동할 수 있다.
- HTML 리소스, Mock 파일 요청, 이전 프로필 링크를 하위 경로에서도 동작하도록 수정했다.

## 빌드

Node.js 22 이상. 별도 의존성 설치 없이 실행한다.

```powershell
$env:YPC_API_BASE = 'https://be-27y9.onrender.com'
npm.cmd test
npm.cmd run check
npm.cmd run build
```

업로드 대상은 **`dist/` 내용 전체**다. HTML, src의 JS/CSS, 예시 JSON과 공개 API 주소를 담은 runtime-config.js만 포함하며 소스 저장소의 docs/tests/scripts/.git은 제외한다. 빌드는 HTTPS API 주소를 필수로 요구한다. 주소가 빠졌을 때 조용히 디자인 예시 모드로 배포하지 않는다.

디자인 확인용 배포가 필요할 때만 `npm.cmd run build:demo`를 사용한다. 이 명령은 같은 dist를 예시 모드로 다시 생성하므로 실제 연동 배포 전에는 API 빌드를 다시 실행한다. `dist/build-info.json`에서 mode와 apiBase를 확인한다. runtime-config.js는 공개 파일이므로 API 키/DB 비밀번호를 넣지 않는다.

정적 호스팅은 dist를 루트 또는 하위 경로에 배치하면 된다. Vercel을 선택한다면 Build Command는 `npm run build`, Output Directory는 `dist`, 환경변수는 위 공개 API 주소다. GitHub Pages를 선택한다면 dist를 Pages 산출물로 게시하며 CORS origin에는 경로 `/FE/`를 넣지 않는다. 계정/저장소 설정 변경이나 공개 배포는 아직 수행하지 않았다.

## 배포 파일 로컬 확인

```powershell
node scripts/preview-build.mjs
# http://127.0.0.1:5174/FE/

$env:YPC_BROWSER_MODE = 'api'
node scripts/check-browser.mjs
Remove-Item Env:YPC_BROWSER_MODE
```

`check-browser.mjs`의 API 모드 검사는 배포 파일 시작/하위 경로/프로필 링크와 브라우저 API 접근 여부를 구분해 출력한다. 시작 검사가 통과해도 `Browser API access=false`라면 전체 연동은 미완료다. 기본 모드는 기존 디자인의 필터/모달/모바일 검사를 실행한다. Windows Chrome이 필요하며 스크린샷은 시스템 임시 폴더 `youthfit-design-check`에 저장된다.

## 백엔드 설정 후 재검증

BE 담당자가 배포 환경에서 확인할 항목:

1. `DATABASE_URL` 및 스키마 마이그레이션, `PROFILE_ENC_KEYS`를 설정하고 `/readyz`의 DB ready=true를 확인한다. 키/접속 문자열은 공개 FE에 넣지 않는다.
2. `CORS_ORIGINS`에 최종 FE origin을 등록한다. 로컬 점검용은 `http://127.0.0.1:5173` 및 `http://127.0.0.1:5174`다. GitHub Pages라면 예: `https://claude-mcp-7team.github.io`이며 `/FE/`는 붙이지 않는다.
3. POST/PUT/DELETE, Content-Type/X-Session-Id preflight를 허용하고 실제 브라우저에서 확인한다. 현재 405인 OPTIONS가 성공해야 한다.
4. 제출용 데이터가 데모 5건인지 실제 공고인지 배포 스냅샷을 확정한다.

설정 완료 후:

```powershell
$env:YPC_API_BASE = 'https://be-27y9.onrender.com'
$env:YPC_FE_ORIGIN = 'http://127.0.0.1:5174'
npm.cmd run check:api
```

점검 스크립트는 가상 프로필만 사용하며 생성한 테스트 세션은 마지막에 삭제한다. 실패한 검사가 있으면 exit code 1을 반환한다. DB가 연결된 뒤 세션 CRUD와 브라우저의 `프로필 저장 → 판정 → 질문 → 답변 저장 → 재판정 → 조합 → 일정`을 다시 실행해야 전체 E2E 완료로 체크할 수 있다.
