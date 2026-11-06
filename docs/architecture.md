# 아키텍처 메모

원본 설계 문서: https://claude.ai/artifact/UQiyXZuXTyBiN6VDn1s2Xm

## 게임 서버

- 방 하나 = Colyseus `MysteryRoom` 하나. 서버가 모든 상태를 쥔다(authoritative).
- 진행은 XState 머신(`phase-machine.ts`): 대기실 → 페이즈 0..N-1 → 종료. 페이즈 구성은 시나리오 데이터.
- 비밀 정보 보호
  - 개인 대본: 캐릭터를 고른 플레이어에게만 `character:script` 메시지로 전송 (상태에 넣지 않음)
  - 단서: `GameState.clues`는 view 필드. 단서를 가진 플레이어의 `client.view`에만 추가되어 전송
  - 투표: 누구를 지목했는지는 결말 전까지 서버 메모리에만 보관, 상태에는 `hasVoted`만
- 단서 지급 규칙(`game-logic.ts`): 장소 없는 단서는 해금 조건을 만족하면 자동 지급(연쇄 해금), 장소 단서는 조사 페이즈에 `clue:investigate`로 획득
- 재접속: `onDrop`에서 120초 동안 `allowReconnection`

## 스튜디오 ↔ 게임 계약

1. 스튜디오는 `scenario_drafts`에 초안을 저장한다.
2. 발행 시 `validateScenario()`를 통과한 JSON을 `scenario_versions`에 새 행으로 저장한다(불변).
3. 게임 서버는 방을 만들 때 `scenario_versions`만 읽고 `migrateScenario()` → `validateScenario()`를 거친다.
4. 스키마를 바꾸면 `SCHEMA_VERSION`을 올리고 `migrate.ts`에 변환을 추가한다.

## 결제

상품(products) → 주문(orders) → 결제(payments) → 이용권(entitlements). 게임·스튜디오는 이용권만 본다.
데모는 관리자 수동 지급(`ManualGrantProvider`), 이후 포트원(웹)·RevenueCat(앱) 어댑터를 `@mm/billing`에 추가한다.
`REQUIRE_ENTITLEMENT=1`이 되면 게임 서버가 방 생성 시 이용권을 확인하도록 연결한다(미구현).

## 다음 할 일

- [ ] Supabase 로그인(카카오·구글) + 초대 코드 화면
- [ ] 게임 종료 시 기록 저장 (`games`, `game_participants`, `game_chat_logs`)
- [ ] 클라이언트 LiveKit 연결, 밀담 음성 방
- [ ] 스튜디오: Supabase 연동, 폼 에디터(React Hook Form), Tiptap 대본, React Flow 페이즈 흐름, 발행
- [ ] 디자인 시스템 컴포넌트(EvidenceCard, PhaseTimer 등)를 shadcn/ui 기반으로 이식
- [ ] Redis presence/driver 연결 (게임 서버 다중 인스턴스)
