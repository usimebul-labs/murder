import type { ScenarioMeta } from "@mm/scenario-schema";

/** 로비 카드·상세 화면이 쓰는 테마 정보와 표기 도우미. 클라이언트 컴포넌트에서도 import한다 */
export type Difficulty = ScenarioMeta["difficulty"];

export type Theme = {
  /** URL에 쓰는 식별자 (/cases/[id]) */
  id: string;
  caseNumber: string;
  title: string;
  /** 카드·배너에 쓰는 한 줄 */
  hook: string;
  /** 상세 화면의 줄거리 */
  synopsis: string;
  year: string;
  place: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedMinutes: number;
  difficulty: Difficulty;
  tags: string[];
  contentWarnings: string[];
  coverImage: string;
  /** 배너에서 표지를 어느 쪽에 맞출지 (object-position) */
  coverPosition?: string;
  /** 실제로 방을 만들 수 있는 시나리오면 그 버전 id */
  scenarioVersionId?: string;
  isNew?: boolean;
  featured?: boolean;
};

/** 상세 화면의 진행 순서 한 줄 */
export type ThemePhase = {
  kind: "prologue" | "investigation" | "discussion" | "statements" | "vote" | "ending";
  name: string;
  minutes: number;
  /** 종류별 기본 설명 대신 쓸 설명 */
  desc?: string;
};

/** 상세 화면(사건 개요 · 진행 순서 · 등장인물)에 쓰는 공개 정보. 비밀 문서나 정답은 넣지 않는다 */
export type ThemeDetail = {
  /** 사건 개요 문서. 장마다 제목·부제·문단 */
  prologue: { title: string; subtitle: string; paras: string[] }[];
  /** 개요 마지막 장 아래의 사건 기록 (VICTIM, LOCATION …) */
  facts: { k: string; v: string }[];
  phases: ThemePhase[];
  /** 아직 인물이 정해지지 않은 데모 테마는 빈 배열 */
  cast: { name: string; role: string; line: string; portrait?: string; colorIndex: number }[];
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "하",
  normal: "중",
  hard: "상",
};

export function peopleLabel(t: Pick<Theme, "minPlayers" | "maxPlayers">) {
  return t.minPlayers === t.maxPlayers ? `${t.minPlayers}인` : `${t.minPlayers}~${t.maxPlayers}인`;
}

/** 새 방을 여는 경로. 준비 중인 테마면 undefined */
export function playPath(t: Theme) {
  return t.scenarioVersionId ? `/play/${t.scenarioVersionId}` : undefined;
}
