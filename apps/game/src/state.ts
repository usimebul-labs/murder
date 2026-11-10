import { type SchemaType, schema, t } from "@colyseus/schema";

/** 모든 플레이어에게 공개되는 캐릭터 정보 (비밀 문서는 메시지로 본인에게만) */
export const CharacterInfo = schema(
  {
    id: t.string().default(""),
    name: t.string().default(""),
    role: t.string().default(""),
    publicProfile: t.string().default(""),
    portraitKey: t.string().default(""),
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
    titleCard: t.string().default(""),
    durationSec: t.uint16().default(0),
    round: t.uint8().default(0),
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
    /** 인물 선택 페이즈에서 지망한 인물 id. 여러 명이 같은 인물을 지망할 수 있다 */
    wishId: t.string().default(""),
    ready: t.boolean().default(false),
    /** 이 페이즈에서 할 일을 마쳤는지 (숙지 완료, 캐릭터 확정 등) */
    done: t.boolean().default(false),
    connected: t.boolean().default(true),
    isHost: t.boolean().default(false),
    /** 테스트 방에서 빈 자리를 채운 AI 봇 */
    isBot: t.boolean().default(false),
    /** 누구에게 투표했는지는 공개하지 않고, 투표 여부만 공개 */
    hasVoted: t.boolean().default(false),
    /** 이번 탐색 라운드에 남은 수집 횟수 */
    picksLeft: t.uint8().default(0),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

/**
 * 보드에 나온 단서 카드의 앞면. 모두에게 공개된다 (분류, 출처, 누가 가졌는지).
 * 제목·내용은 ClueState(view 필드)로 가진 사람과 공개 후 모두에게만 보낸다.
 */
export const ClueCard = schema(
  {
    id: t.string().default(""),
    code: t.string().default(""),
    category: t.string().default(""),
    source: t.string().default(""),
    locationId: t.string().default(""),
    /** 보드에 처음 나온 라운드 */
    round: t.uint8().default(0),
    /** 가진 캐릭터 id. 비어 있으면 아직 보드 위에 있다 */
    holderId: t.string().default(""),
    /** 전체 공개 여부 */
    isPublic: t.boolean().default(false),
    /** 공개한 캐릭터 id */
    sharedBy: t.string().default(""),
  },
  "ClueCard",
);
export type ClueCard = SchemaType<typeof ClueCard>;

/** 단서의 뒷면. clues 맵은 view 필드라서 client.view에 추가된 단서만 그 클라이언트에 전송된다 */
export const ClueState = schema(
  {
    id: t.string().default(""),
    code: t.string().default(""),
    title: t.string().default(""),
    body: t.string().default(""),
    imageKey: t.string().default(""),
    category: t.string().default(""),
    source: t.string().default(""),
  },
  "ClueState",
);
export type ClueState = SchemaType<typeof ClueState>;

/** 목표 결산의 판정단 항목 (다른 참가자가 달성 여부를 판정) */
export const JuryItem = schema(
  {
    characterId: t.string().default(""),
    objectiveId: t.string().default(""),
    prompt: t.string().default(""),
    yes: t.uint8().default(0),
    no: t.uint8().default(0),
    /** 판정한 캐릭터 id (누가 어떻게 판정했는지는 비공개) */
    voters: t.array("string"),
  },
  "JuryItem",
);
export type JuryItem = SchemaType<typeof JuryItem>;

export const GameState = schema(
  {
    status: t.string().default("lobby"),
    scenarioTitle: t.string().default(""),
    preview: t.boolean().default(false),
    minPlayers: t.uint8().default(0),
    /** 모집 인원 (방을 만들 때 고른 인원) */
    capacity: t.uint8().default(0),
    characters: t.array(CharacterInfo),
    phases: t.array(PhaseInfo),
    phaseIndex: t.int8().default(-1),
    /** epoch ms. 0이면 시간 제한 없음 */
    phaseEndsAt: t.float64().default(0),
    players: t.map(Player),
    cards: t.map(ClueCard),
    clues: t.map(ClueState).view(),

    /** 탐색: 수집 순서(캐릭터 id)와 지금 차례 */
    turnOrder: t.array("string"),
    turnCharacterId: t.string().default(""),
    turnEndsAt: t.float64().default(0),
    turnNumber: t.uint8().default(0),
    turnTotal: t.uint8().default(0),

    /** 최후 진술: 발언 순서와 지금 발언자 */
    speakerOrder: t.array("string"),
    speakerCharacterId: t.string().default(""),
    speakerEndsAt: t.float64().default(0),
    speakerSec: t.uint16().default(0),

    /** 투표: 결선 투표 후보 (비어 있으면 전원이 후보) */
    voteRound: t.uint8().default(1),
    runoffCandidates: t.array("string"),

    accusedCharacterId: t.string().default(""),
    endingId: t.string().default(""),
    jury: t.map(JuryItem),
    /** 목표 결산부터 채워지는 결과 (GameResult JSON) */
    result: t.string().default(""),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;
