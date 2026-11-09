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
