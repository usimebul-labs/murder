# 작업 규칙

- 모노레포: pnpm + Turborepo. 커밋 전 `pnpm check`가 통과해야 한다.
- 게임 플레이(`apps/web`, `apps/game`, `packages/game-protocol`, `packages/billing`)와 스튜디오(`apps/studio`)는 서로 import하지 않는다.
  공유가 필요한 도메인 타입·검증은 `packages/scenario-schema`에만 둔다. 경계는 `turbo boundaries`와 Biome이 검사한다.
- 시나리오 JSON 형식을 바꾸면 `SCHEMA_VERSION`을 올리고 `packages/scenario-schema/src/migrate.ts`에 변환을 추가한다.
- 게임 서버 상태에 비밀 정보(개인 대본, 남의 단서, 투표 대상)를 그대로 넣지 않는다. view 필드나 개별 메시지를 쓴다.
- UI 문구는 디자인 시스템 README의 톤(하십시오체/해요체 규칙)을 따른다.
