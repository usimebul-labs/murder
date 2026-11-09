# 머더 미스터리 온라인

4~8인이 실시간으로 접속해 캐릭터를 맡고, 대화·단서 수집·투표로 범인을 찾는 온라인 머더 미스터리 서비스입니다.
설계 배경은 [기술 스택·운영 환경 설계 문서](https://claude.ai/artifact/UQiyXZuXTyBiN6VDn1s2Xm)와 [docs/architecture.md](docs/architecture.md)를 참고하세요.

## 구조

pnpm + Turborepo 모노레포입니다. **게임 플레이(play)와 스튜디오(studio)는 별개의 모듈**이며,
도메인 코드는 `@mm/scenario-schema` 하나만 공유합니다.

| 경로                       | 태그   | 역할                                                                          |
| -------------------------- | ------ | ----------------------------------------------------------------------------- |
| `apps/web`                 | play   | 플레이어용 Next.js 앱 (로비, 게임 화면, API, PWA)                             |
| `apps/game`                | play   | Colyseus 실시간 게임 서버 (페이즈 상태 머신, 단서 가시성, 투표, LiveKit 토큰) |
| `apps/studio`              | studio | 시나리오 에디터 (별도 빌드·배포)                                              |
| `packages/scenario-schema` | shared | 시나리오 Zod 스키마, 검증, 마이그레이션, 샘플 — 유일한 도메인 공유            |
| `packages/game-protocol`   | play   | web ↔ game 메시지 규약                                                        |
| `packages/billing`         | play   | 결제 어댑터 인터페이스, 이용권 지급 (데모는 수동 지급)                        |
| `packages/db`              | shared | Drizzle 스키마·마이그레이션 (Supabase Postgres)                               |
| `packages/ui`              | shared | 디자인 시스템 토큰 + 도메인 무관 기본 컴포넌트                                |
| `packages/config`          | shared | tsconfig 프리셋                                                               |

경계 규칙은 두 겹으로 검사합니다.

- `turbo boundaries`: play는 play·shared만, studio는 studio·shared만 의존 가능 (`turbo.json`)
- Biome `noRestrictedImports`: 스튜디오 코드에서 play 패키지 import 금지 (`biome.json`)

스튜디오와 게임 서버는 서로의 코드를 호출하지 않고, DB의 `scenario_versions`(검증된 불변 JSON)로만 주고받습니다.

## 시작하기

```bash
corepack enable
pnpm install
cp apps/game/.env.example apps/game/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/studio/.env.example apps/studio/.env.local
pnpm dev
```

- 플레이어 앱: http://localhost:3000 → "샘플 사건 입장" (DB·Supabase 없이 샘플 시나리오와 `dev:` 토큰으로 동작)
- 스튜디오: http://localhost:3001
- 게임 서버: ws://localhost:2567 (`/health`)

DB를 쓰려면 `pnpm infra:up`(Postgres·Redis) 후 `DATABASE_URL`을 설정하고 `pnpm db:generate && pnpm db:migrate`를 실행합니다.

## 검사

```bash
pnpm check   # lint + 경계 검사 + typecheck + test + build
```

## 배포 (개발·비공개 데모 단계)

| 대상                      | 서비스                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `apps/web`, `apps/studio` | Vercel Hobby (프로젝트 2개, Root Directory를 각 앱으로)                                |
| DB·인증·스토리지          | Supabase Free                                                                          |
| 음성                      | LiveKit Cloud 무료 플랜                                                                |
| `apps/game`               | **로컬 PC** + Tailscale Funnel: [docs/local-game-server.md](docs/local-game-server.md) |

공개 출시 단계에서는 게임 서버를 같은 Docker 이미지(`docker build -f infra/game.Dockerfile .`)로
관리형 서비스나 VM(`infra/demo-vm.compose.yml`)으로 옮깁니다.
