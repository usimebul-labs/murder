import type {
  CharacterScript,
  ClueCategory,
  Objective,
  PhaseKind,
  PublicScenario,
} from "@mm/scenario-schema";

/** Colyseus에 등록하는 방 이름 */
export const ROOM_NAME = "mystery" as const;

/** 방을 만들 때 클라이언트가 보내는 옵션 */
export interface CreateRoomOptions {
  /** 발행된 시나리오 버전 id (scenario_versions.id) */
  scenarioVersionId: string;
  /**
   * 테스트 방 여부. 켜면 최소 인원 없이 시작할 수 있고,
   * 시작할 때 남은 빈 자리를 AI 봇 참가자로 채운다 (혼자서도 끝까지 진행해 볼 수 있다)
   */
  preview?: boolean;
  /** 대기실 목록에 보이는 방 제목 (최대 30자) */
  title?: string;
  /** 모집 인원. 시나리오의 최소~최대 인원 사이로 맞춘다 */
  maxPlayers?: number;
  /** 방 성격 (최대 3개, 짝지어진 태그는 하나만) */
  tags?: RoomTag[];
  /** public이면 대기실 목록에 보이고, private이면 초대 코드로만 들어온다 */
  visibility?: RoomVisibility;
}

export const ROOM_TAGS = ["beginner", "veteran", "casual", "roleplay", "voice", "chat"] as const;
export type RoomTag = (typeof ROOM_TAGS)[number];
/** 함께 고를 수 없는 태그 쌍 */
export const ROOM_TAG_EXCLUSIVE: [RoomTag, RoomTag][] = [
  ["beginner", "veteran"],
  ["voice", "chat"],
];
export const MAX_ROOM_TAGS = 3;
export const MAX_ROOM_TITLE = 30;
export type RoomVisibility = "public" | "private";

/** 초대 코드 형식: 영문 대문자 4~6자 + 숫자 4자리 (예: RAVEN-0427). 방 id로도 쓴다 */
export const ROOM_CODE_PATTERN = /^[A-Z]{4,6}-\d{4}$/;

/** 대기실 목록·초대 코드에 쓰는 방 정보 (Colyseus 방 metadata) */
export interface RoomListing {
  code: string;
  scenarioVersionId: string;
  title: string;
  tags: RoomTag[];
  players: number;
  maxPlayers: number;
  status: "waiting" | "playing";
  /** 테스트 방 (빈 자리를 AI 봇이 채운다) */
  test: boolean;
}

/** 태그 목록을 규칙(허용 값, 쌍 배타, 최대 개수)에 맞게 정리한다 */
export function normalizeRoomTags(input: unknown): RoomTag[] {
  if (!Array.isArray(input)) return [];
  const out: RoomTag[] = [];
  for (const t of input) {
    if (!(ROOM_TAGS as readonly unknown[]).includes(t)) continue;
    const tag = t as RoomTag;
    if (out.includes(tag)) continue;
    const pair = ROOM_TAG_EXCLUSIVE.find((p) => p.includes(tag));
    if (pair && out.some((x) => pair.includes(x))) continue;
    out.push(tag);
    if (out.length >= MAX_ROOM_TAGS) break;
  }
  return out;
}

/** 방에 들어올 때 보내는 옵션. 인증 토큰은 Colyseus auth 헤더로 별도 전달 */
export interface JoinRoomOptions {
  nickname?: string;
}

/** 클라이언트 → 서버 메시지 */
export interface ClientMessages {
  "character:select": { characterId: string };
  "player:ready": { ready: boolean };
  /** 이 페이즈에서 할 일을 마쳤다 (프롤로그·비밀 문서 숙지, 캐릭터 확정, 발언 종료) */
  "player:done": { done: boolean };
  "phase:advance": Record<string, never>;
  "chat:send": { channel: "all" | `whisper:${string}`; text: string };
  /** 탐색 라운드: 자기 차례에 보드의 카드 한 장을 줍는다 */
  "clue:pick": { clueId: string };
  /** 가진 단서를 모두에게 공개 */
  "clue:share": { clueId: string };
  /** 가진 단서를 다른 인물에게 건넨다 (되돌릴 수 없음) */
  "clue:give": { clueId: string; toCharacterId: string };
  "vote:cast": { suspectCharacterId: string };
  /** 목표 결산: 판정단 목표에 대한 다른 참가자의 판정 */
  "jury:vote": { characterId: string; objectiveId: string; achieved: boolean };
  "voice:token": Record<string, never>;
}

/** 캐릭터를 맡은 플레이어에게만 보내는 목표 (판정 조건은 빼고 문구만) */
export type ObjectiveBrief = Pick<Objective, "id" | "kind" | "text" | "points"> & {
  judge: Objective["judge"]["kind"];
};

/** 서버 → 클라이언트 메시지 (상태 동기화 외 이벤트) */
export interface ServerMessages {
  /** 입장 직후: 비밀이 빠진 시나리오 (프롤로그, 규칙, 인물 소개, 장소) */
  "scenario:public": PublicScenario;
  "chat:message": ChatMessage;
  /** 입장 직후: 지금까지 이 플레이어가 볼 수 있는 대화 기록 */
  "chat:history": ChatMessage[];
  /** 캐릭터가 정해지면 그 플레이어에게만 보내는 비밀 문서 */
  "character:script": {
    characterId: string;
    script: CharacterScript;
    objectives: ObjectiveBrief[];
    isCulprit: boolean;
  };
  "clue:acquired": { clue: ClueView; from: "search" | "auto" | "public" | "given" };
  "voice:token": { url: string; token: string; roomName: string };
  "phase:changed": { phaseId: string; kind: PhaseKind; endsAt: number | null };
  error: { code: ErrorCode; message: string };
}

/** 내용을 볼 수 있는 단서 (가진 사람 또는 공개된 단서) */
export interface ClueView {
  id: string;
  code: string;
  title: string;
  body: string;
  imageKey?: string;
  category: ClueCategory;
  source: string;
}

export interface ChatMessage {
  id: string;
  channel: "all" | "gm" | `whisper:${string}`;
  fromSessionId: string | null;
  characterId: string | null;
  text: string;
  sentAt: number;
}

/** 목표 결산·결말 화면에 쓰는 결과. 목표 결산 페이즈부터 상태에 JSON으로 실린다 */
export interface GameResult {
  culpritId: string;
  accusedId: string | null;
  /** 투표한 캐릭터 id → 지목한 캐릭터 id */
  votes: Record<string, string>;
  ending: { id: string; title: string; body: string };
  solution?: {
    motive: string;
    method: string;
    timeline: { time: string; locationId?: string; text: string; clueIds: string[] }[];
    keyClueIds: string[];
  };
  scores: {
    characterId: string;
    objectives: {
      id: string;
      kind: "main" | "sub";
      text: string;
      points: number;
      judge: "auto" | "jury" | "gm";
      prompt?: string;
      /** null = 아직 판정 전 */
      achieved: boolean | null;
      /** 판정단 목표: 지금까지 받은 판정 수 */
      juryYes?: number;
      juryNo?: number;
      juryVoters?: string[];
    }[];
    culpritVote: boolean;
    total: number;
  }[];
  /** 전체 단서의 앞·뒷면과 마지막 보유자 (결말에서 모두 공개) */
  clues: (ClueView & { holderIds: string[]; isKey: boolean })[];
  /** 인물별 봉인된 진실 (결말 04 비밀) */
  secrets: { characterId: string; text: string }[];
}

export type ErrorCode =
  | "not-allowed-in-phase"
  | "character-taken"
  | "not-host"
  | "not-your-turn"
  | "no-entitlement"
  | "invalid-message";

export type ClientMessageType = keyof ClientMessages;
export type ServerMessageType = keyof ServerMessages;
