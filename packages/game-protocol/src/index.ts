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
  /** 미리보기 방 여부. 켜면 최소 인원 없이 시작할 수 있다 (테스트 플레이) */
  preview?: boolean;
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
