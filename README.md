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

기존 디자인 사이트는 `npm.cmd run preview`로 실행합니다.
기존 추천 조합 주소: http://127.0.0.1:4173/index.html#combination
로컬 사이트는 해당 서버 실행을 유지해야 접속할 수 있습니다.

- `src/`: 공통 UI, 라우팅, 계약 검증
- `mocks/scenario.json`: 네 가지 판정 상태를 포함한 공유 JSON
- `prototype/index.html`: 기존 정적 초안 원본
- [화면·API 계약 초안](docs/Frontend-contract.md)
- [진행 기록과 남은 작업](docs/Frontend-progress.md)

모든 정책과 판정은 가상 예시입니다. 서버 저장 및 실제 AI/API 연결은 아직 없습니다. M0 계약 합의 후 M1부터 순서대로 진행합니다.
