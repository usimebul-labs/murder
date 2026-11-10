import type { ChatMessage, ServerMessages } from "@mm/game-protocol";
import type { ClueCategory, PhaseKind, PublicScenario } from "@mm/scenario-schema";

/** 서버 GameState를 toJSON()한 모양 (게임 서버 state.ts와 맞춘다) */
export interface GameSnapshot {
  status: "lobby" | "playing" | "finished";
  scenarioTitle: string;
  preview: boolean;
  minPlayers: number;
  characters: CharacterInfo[];
  phases: PhaseInfo[];
  phaseIndex: number;
  phaseEndsAt: number;
  players: Record<string, PlayerInfo>;
  cards: Record<string, ClueCardInfo>;
  /** view 필드라서 이 플레이어가 볼 수 있는 단서가 생기기 전에는 없다 */
  clues?: Record<string, ClueInfo>;
  turnOrder: string[];
  turnCharacterId: string;
  turnEndsAt: number;
  turnNumber: number;
  turnTotal: number;
  speakerOrder: string[];
  speakerCharacterId: string;
  speakerEndsAt: number;
  /** 한 사람의 발언 시간(초) */
  speakerSec: number;
  voteRound: number;
  runoffCandidates: string[];
  /** "none"이면 지목 실패 */
  accusedCharacterId: string;
  endingId: string;
  jury: Record<
    string,
    {
      characterId: string;
      objectiveId: string;
      prompt: string;
      yes: number;
      no: number;
      voters: string[];
    }
  >;
  result: string;
}

export interface CharacterInfo {
  id: string;
  name: string;
  role: string;
  publicProfile: string;
  portraitKey: string;
  colorIndex: number;
}

export interface PhaseInfo {
  id: string;
  kind: PhaseKind;
  title: string;
  titleCard: string;
  durationSec: number;
  round: number;
  allowWhisper: boolean;
  voiceEnabled: boolean;
}

export interface PlayerInfo {
  userId: string;
  nickname: string;
  characterId: string;
  /** 인물 선택 페이즈에서 지망한 인물 (겹칠 수 있다) */
  wishId: string;
  ready: boolean;
  done: boolean;
  connected: boolean;
  isHost: boolean;
  hasVoted: boolean;
  picksLeft: number;
}

export interface ClueCardInfo {
  id: string;
  code: string;
  category: ClueCategory;
  source: string;
  locationId: string;
  round: number;
  holderId: string;
  isPublic: boolean;
  sharedBy: string;
}

export interface ClueInfo {
  id: string;
  code: string;
  title: string;
  body: string;
  imageKey: string;
  category: ClueCategory;
  source: string;
}

export type Script = ServerMessages["character:script"];
export type { ChatMessage, PublicScenario };

/** 화면 컴포넌트가 공통으로 받는 값 */
export interface GameContext {
  roomId: string;
  sessionId: string;
  state: GameSnapshot;
  scenario: PublicScenario | null;
  script: Script | null;
  chat: ChatMessage[];
  me: PlayerInfo | undefined;
  myCharacterId: string;
  phase: PhaseInfo | undefined;
  send: <K extends keyof import("@mm/game-protocol").ClientMessages>(
    type: K,
    payload: import("@mm/game-protocol").ClientMessages[K],
  ) => void;
  character: (id: string) => CharacterInfo | undefined;
  playerOf: (characterId: string) => PlayerInfo | undefined;
}
