# YouthFit AI Frontend

청년정책 자격 판정 서비스의 M0 화면·Mock 계약 초안입니다.

Node.js 22 이상에서 추가 패키지 설치 없이 실행합니다.

```sh
npm run dev
npm test
npm run check
```

Windows PowerShell 실행 정책으로 npm이 차단되면 `npm.cmd`를 사용하세요.
실행 주소: http://127.0.0.1:5173

기본 화면은 `docs/assets/iamges` 이미지 기준 대시보드입니다. **조건 수정** 또는 `http://127.0.0.1:5173/#/profile`에서 같은 대시보드 위에 입력 팝업을 엽니다. `preview`의 4173도 같은 화면 모듈을 사용합니다. 기본 모드의 수치와 판정은 디자인 예시이며 팝업 입력은 이 탭에만 보관됩니다. `YPC_API_BASE` 설정 시에는 기존 실제 API 흐름을 사용합니다.

기존 디자인 사이트는 `npm.cmd run preview`로 실행합니다.
기존 추천 조합 주소: http://127.0.0.1:4173/index.html#combination
로컬 사이트는 해당 서버 실행을 유지해야 접속할 수 있습니다.

사용자 조건 입력은 기존 사이트의 **조건 수정/프로필 버튼**, 또는
http://127.0.0.1:4173/profile.html 에서 확인합니다.
앱의 http://127.0.0.1:5173/#/profile 에서 조건 수정 팝업을 엽니다. 기존 `/profile.html` 주소도 이 경로로 이동합니다.
기본 모드는 탭 단위 임시 보관·수정·삭제와 클라이언트 검증을 지원합니다.
`YPC_API_BASE`를 설정하면 프로필 서버 조회·저장·삭제와 판정·역질문·조합·신청 계획 API 화면을 사용합니다. 설정 방법과 미지원 입력값은 [Profile API 연동](docs/Profile-api.md)을 참고하세요. 실제 배포 BE/CORS의 전체 흐름 검증은 남아 있습니다.
필드·검증 초안과 확인 순서는 [입력 폼 문서](docs/Profile-form.md)를 참고하세요.

- `src/`: 공통 UI, 라우팅, 계약 검증
- `mocks/scenario.json`: 네 가지 판정 상태를 포함한 공유 JSON
- `prototype/index.html`: 기존 정적 초안 원본
- [화면·API 계약 초안](docs/Frontend-contract.md)
- [판정 상태·근거 표현 규격](docs/Design-states.md)
- [디자인 시스템](docs/Design-system.md)
- [서류·일정 화면 스펙](docs/Design-schedule.md)
- [진행 기록과 남은 작업](docs/Frontend-progress.md)
- [판정 API 클라이언트와 검증 범위](docs/Judgement-api.md) · 분석·결과 화면 연결
- [역질문 API와 재판정 흐름](docs/Questions-api.md) · 질문 화면 연결
- [신청 계획 API 계약](docs/Plan-api.md) · 서류 체크리스트·일정 연결
- [조합 추천 API 계약](docs/Combination-api.md) · 조합 화면 연결

기본 모드의 정책과 판정은 가상 예시입니다. API 설정 모드는 서버 응답을 사용하며, 실제 배포 BE/CORS 통합 검증은 아직 남아 있습니다.
