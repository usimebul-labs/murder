import type { Clue, PhaseKind } from "@mm/scenario-schema";

/** Colyseus에 등록하는 방 이름 */
export const ROOM_NAME = "mystery" as const;

/** 방을 만들 때 클라이언트가 보내는 옵션 */
export interface CreateRoomOptions {
  /** 발행된 시나리오 버전 id (scenario_versions.id) */
  scenarioVersionId: string;
  /** 미리보기 방 여부 (스튜디오 테스트 플레이 링크로 생성) */
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
  "phase:advance": Record<string, never>;
  "chat:send": { channel: "all" | `whisper:${string}`; text: string };
  "clue:investigate": { location: string };
  "clue:share": { clueId: string };
  "vote:cast": { suspectCharacterId: string };
  "voice:token": Record<string, never>;
}

/** 서버 → 클라이언트 메시지 (상태 동기화 외 이벤트) */
export interface ServerMessages {
  "chat:message": ChatMessage;
  /** 캐릭터를 고르면 그 플레이어에게만 보내는 개인 대본 */
  "character:script": { characterId: string; privateScript: string; goals: string[] };
  "clue:acquired": { clue: Pick<Clue, "id" | "code" | "title" | "body" | "imageKey"> };
  "voice:token": { url: string; token: string; roomName: string };
  "phase:changed": { phaseId: string; kind: PhaseKind; endsAt: number | null };
  error: { code: ErrorCode; message: string };
}

export interface ChatMessage {
  id: string;
  channel: "all" | "gm" | `whisper:${string}`;
  fromSessionId: string | null;
  characterId: string | null;
  text: string;
  sentAt: number;
}

export type ErrorCode =
  | "not-allowed-in-phase"
  | "character-taken"
  | "not-host"
  | "no-entitlement"
  | "invalid-message";

export type ClientMessageType = keyof ClientMessages;
export type ServerMessageType = keyof ServerMessages;
