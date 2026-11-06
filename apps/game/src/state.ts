import { type SchemaType, schema, t } from "@colyseus/schema";

/** 모든 플레이어에게 공개되는 캐릭터 정보 (개인 대본은 메시지로 본인에게만) */
export const CharacterInfo = schema(
  {
    id: t.string().default(""),
    name: t.string().default(""),
    publicProfile: t.string().default(""),
    colorIndex: t.uint8().default(0),
  },
  "CharacterInfo",
);
export type CharacterInfo = SchemaType<typeof CharacterInfo>;

export const PhaseInfo = schema(
  {
    id: t.string().default(""),
    kind: t.string().default(""),
    title: t.string().default(""),
    durationSec: t.uint16().default(0),
    allowWhisper: t.boolean().default(false),
    voiceEnabled: t.boolean().default(false),
  },
  "PhaseInfo",
);
export type PhaseInfo = SchemaType<typeof PhaseInfo>;

export const Player = schema(
  {
    userId: t.string().default(""),
    nickname: t.string().default(""),
    characterId: t.string().default(""),
    ready: t.boolean().default(false),
    connected: t.boolean().default(true),
    isHost: t.boolean().default(false),
    /** 누구에게 투표했는지는 공개하지 않고, 투표 여부만 공개 */
    hasVoted: t.boolean().default(false),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

/** 단서. clues 맵은 view 필드라서 client.view에 추가된 단서만 그 클라이언트에 전송된다 */
export const ClueState = schema(
  {
    id: t.string().default(""),
    code: t.string().default(""),
    title: t.string().default(""),
    body: t.string().default(""),
    imageKey: t.string().default(""),
    /** 전체 공유한 플레이어의 캐릭터 id (공유 전이면 빈 문자열) */
    sharedBy: t.string().default(""),
  },
  "ClueState",
);
export type ClueState = SchemaType<typeof ClueState>;

export const GameState = schema(
  {
    status: t.string().default("lobby"),
    scenarioTitle: t.string().default(""),
    characters: t.array(CharacterInfo),
    phases: t.array(PhaseInfo),
    phaseIndex: t.int8().default(-1),
    /** epoch ms. 0이면 시간 제한 없음 */
    phaseEndsAt: t.float64().default(0),
    players: t.map(Player),
    clues: t.map(ClueState).view(),
    accusedCharacterId: t.string().default(""),
    endingId: t.string().default(""),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;
