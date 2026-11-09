import type { Character, Clue, Condition, Ending, Scenario } from "@mm/scenario-schema";

/** 조건 판정에 필요한 게임 진행 상황 */
export interface GameFacts {
  /** 지금까지 시작된 조사 라운드 수 (첫 조사 전에는 0) */
  round: number;
  /** 캐릭터 id → 보유 단서 id */
  owned: ReadonlyMap<string, ReadonlySet<string>>;
  /** 전체 공개된 단서 id */
  publicClueIds: ReadonlySet<string>;
  /** 지목된 캐릭터 (투표 전·미지목이면 null) */
  accusedId?: string | null;
  /** 투표한 캐릭터 id → 지목한 캐릭터 id */
  votes?: ReadonlyMap<string, string>;
}

/** 현재 페이즈까지 시작된 조사 라운드 수 */
export function currentRound(scenario: Scenario, phaseIndex: number): number {
  let round = 0;
  scenario.phases.slice(0, phaseIndex + 1).forEach((p) => {
    if (p.kind === "investigation") round = p.round;
  });
  return round;
}

/** 시나리오 조건 판정. self = 목표 판정 대상 캐릭터 */
export function evaluateCondition(c: Condition, facts: GameFacts, self?: string): boolean {
  const who = (by: string | undefined) =>
    by === "self" ? self : by && by !== "anyone" ? by : undefined;
  switch (c.kind) {
    case "always":
      return true;
    case "clue-collected": {
      const by = who(c.by);
      if (by) return facts.owned.get(by)?.has(c.clueId) ?? false;
      return [...facts.owned.values()].some((set) => set.has(c.clueId));
    }
    case "clue-public":
      return facts.publicClueIds.has(c.clueId);
    case "clue-held-by": {
      const by = who(c.by);
      return !!by && (facts.owned.get(by)?.has(c.clueId) ?? false);
    }
    case "accused-is":
      return !!facts.accusedId && c.characterIds.includes(facts.accusedId);
    case "no-accused":
      return !facts.accusedId;
    case "voted-for": {
      const votes = facts.votes ?? new Map<string, string>();
      const by = who(c.by);
      if (by) return c.characterIds.includes(votes.get(by) ?? "");
      return [...votes.values()].some((v) => c.characterIds.includes(v));
    }
    case "all":
      return c.of.every((x) => evaluateCondition(x, facts, self));
    case "any":
      return c.of.some((x) => evaluateCondition(x, facts, self));
    case "not":
      return !evaluateCondition(c.condition, facts, self);
  }
}

/** 이 캐릭터가 얻을 수 있는 단서인지 (시나리오의 공개 대상 규칙) */
export function canSee(clue: Clue, characterId: string): boolean {
  return clue.visibility.kind === "all" || clue.visibility.characterIds.includes(characterId);
}

/** 해금 조건(라운드 도달, 추가 조건)을 만족하는지 */
export function isUnlocked(clue: Clue, facts: GameFacts): boolean {
  if (facts.round < clue.unlock.fromRound) return false;
  return clue.unlock.when ? evaluateCondition(clue.unlock.when, facts) : true;
}

/**
 * 조사 없이 받는 단서(공통 자료, 자동 배포): 해금 조건을 만족하고 이 캐릭터에게 공개되는 단서.
 * 페이즈가 바뀌거나 단서가 오갈 때마다 다시 계산한다.
 */
export function autoUnlockedClues(
  scenario: Scenario,
  characterId: string,
  facts: GameFacts,
): Clue[] {
  const owned = facts.owned.get(characterId) ?? new Set<string>();
  return scenario.clues.filter(
    (c) =>
      c.distribution !== "search" &&
      !owned.has(c.id) &&
      (c.distribution === "public" || canSee(c, characterId)) &&
      isUnlocked(c, facts),
  );
}

/** 장소 조사로 얻을 수 있는 단서 */
export function cluesAtLocation(
  scenario: Scenario,
  locationId: string,
  characterId: string,
  facts: GameFacts,
): Clue[] {
  const location = scenario.locations.find((l) => l.id === locationId);
  if (!location || facts.round < location.openFromRound) return [];
  const owned = facts.owned.get(characterId) ?? new Set<string>();
  return scenario.clues.filter(
    (c) =>
      c.distribution === "search" &&
      c.locationId === locationId &&
      !owned.has(c.id) &&
      canSee(c, characterId) &&
      isUnlocked(c, facts),
  );
}

/** 투표 집계: 최다 득표 캐릭터 (동률이면 null) */
export function tallyVotes(votes: Iterable<string>): string | null {
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  let tie = false;
  for (const [id, n] of counts) {
    if (n > bestCount) {
      best = id;
      bestCount = n;
      tie = false;
    } else if (n === bestCount) {
      tie = true;
    }
  }
  return tie ? null : best;
}

/** 지목 결과에 맞는 결말 선택: 위에서부터 처음 만족하는 결말 */
export function pickEnding(scenario: Scenario, facts: GameFacts): Ending {
  const ending = scenario.endings.find((e) => evaluateCondition(e.condition, facts));
  if (!ending) throw new Error("결말이 없습니다");
  return ending;
}

/** 비밀 문서를 한 덩어리 마크다운으로 (G-02 화면이 구조화된 script를 쓰기 전까지의 임시 형식) */
export function renderPrivateScript(character: Character): string {
  const s = character.script;
  const people = s.relationships.map((r) => `- ${r.characterId}: ${r.text}`).join("\n");
  const night = s.timeline
    .map((t) => `- ${t.time} ${t.text}${t.secret ? " (비밀)" : ""}`)
    .join("\n");
  return [
    `## 당신은 누구인가\n${s.identity}`,
    people && `## 당신이 아는 사람들\n${people}`,
    night && `## 그날 밤의 행적\n${night}`,
    `## 봉인된 진실\n${s.sealedTruth.text}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
