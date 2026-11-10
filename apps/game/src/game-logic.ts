import type { Character, Clue, Condition, Ending, Scenario } from "@mm/scenario-schema";

/** 조건 판정에 필요한 게임 진행 상황 */
export interface GameFacts {
  /** 지금까지 시작된 조사 라운드 수 (첫 조사 전에는 0) */
  round: number;
  /** 캐릭터 id → 보유 단서 id */
  owned: ReadonlyMap<string, ReadonlySet<string>>;
  /** 캐릭터 id → 한 번이라도 손에 넣은 단서 id (건넨 단서 포함). 없으면 owned를 쓴다 */
  collected?: ReadonlyMap<string, ReadonlySet<string>>;
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
      const pool = facts.collected ?? facts.owned;
      const by = who(c.by);
      if (by) return pool.get(by)?.has(c.clueId) ?? false;
      return [...pool.values()].some((set) => set.has(c.clueId));
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
  const owned = (facts.collected ?? facts.owned).get(characterId) ?? new Set<string>();
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

/**
 * 보드에 나와 있어야 하는 탐색 단서: 장소가 열렸고 해금 조건을 만족한 search 단서.
 * 누가 이미 가져갔는지와 상관없이 돌려준다 (카드는 한 번 나오면 보드에 남는다).
 */
export function boardClues(scenario: Scenario, facts: GameFacts): Clue[] {
  const open = new Set(
    scenario.locations.filter((l) => facts.round >= l.openFromRound).map((l) => l.id),
  );
  return scenario.clues.filter(
    (c) =>
      c.distribution === "search" &&
      !!c.locationId &&
      open.has(c.locationId) &&
      isUnlocked(c, facts),
  );
}

/**
 * 탐색 라운드의 수집 순서. seat-rotating이면 라운드마다 시작 순번이 한 칸씩 밀린다.
 * 각자 pointsPerPlayer번씩, 한 바퀴에 한 장씩 돌아가며 줍는다.
 */
export function turnSequence(
  seats: readonly string[],
  round: number,
  pointsPerPlayer: number,
  order: "seat-rotating" | "seat" | "random" | "free",
  random: () => number = Math.random,
): string[] {
  let base = [...seats];
  if (order === "seat-rotating" && base.length > 0) {
    const shift = (round - 1) % base.length;
    base = [...base.slice(shift), ...base.slice(0, shift)];
  } else if (order === "random") {
    base = shuffle(base, random);
  }
  const sequence: string[] = [];
  for (let i = 0; i < pointsPerPlayer; i++) sequence.push(...base);
  return sequence;
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** 투표 집계: 최다 득표 캐릭터들 (동률이면 여럿, 표가 없으면 빈 배열) */
export function topVoted(votes: Iterable<string>): string[] {
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
  const max = Math.max(0, ...counts.values());
  if (max === 0) return [];
  return [...counts].filter(([, n]) => n === max).map(([id]) => id);
}

export interface ObjectiveScore {
  id: string;
  kind: "main" | "sub";
  text: string;
  points: number;
  judge: "auto" | "jury" | "gm";
  prompt?: string;
  achieved: boolean | null;
}

/**
 * 목표 결산. 자동 판정은 조건으로, 판정단 목표는 juryVerdict(과반)로 정한다.
 * 진범에게 투표한 사람(진범 본인 제외)은 scoring.culpritVotePoints를 더 받는다.
 */
export function scoreCharacter(
  scenario: Scenario,
  character: Character,
  facts: GameFacts,
  juryVerdict: (objectiveId: string) => boolean | null,
): { objectives: ObjectiveScore[]; culpritVote: boolean; total: number } {
  const objectives = character.objectives.map((o): ObjectiveScore => {
    const achieved =
      o.judge.kind === "auto"
        ? evaluateCondition(o.judge.condition, facts, character.id)
        : juryVerdict(o.id);
    return {
      id: o.id,
      kind: o.kind,
      text: o.text,
      points: o.points,
      judge: o.judge.kind,
      prompt: o.judge.kind === "auto" ? undefined : o.judge.prompt,
      achieved,
    };
  });
  const culpritIds = new Set(scenario.characters.filter((c) => c.isCulprit).map((c) => c.id));
  const vote = facts.votes?.get(character.id);
  const culpritVote = !character.isCulprit && !!vote && culpritIds.has(vote);
  const total =
    objectives.reduce((sum, o) => sum + (o.achieved ? o.points : 0), 0) +
    (culpritVote ? scenario.scoring.culpritVotePoints : 0);
  return { objectives, culpritVote, total };
}

/** 결말 본문의 {accused}를 지목된 인물 이름으로 바꾼다 */
export function renderEndingBody(scenario: Scenario, ending: Ending, accusedId: string | null) {
  const name = scenario.characters.find((c) => c.id === accusedId)?.name ?? "아무도";
  return ending.body.replaceAll("{accused}", name);
}

/** 역할 배정 결과: 참가자 키 → 맡을 인물 id, 그리고 추첨이 있었던 인물별 지망자 */
export interface CastingResult {
  assigned: Map<string, string>;
  lotteries: { characterId: string; wishers: string[]; winner: string }[];
}

/**
 * 지망을 받아 인물을 배정한다.
 * 한 인물을 한 명만 지망하면 그 사람이 맡고, 여러 명이 지망하면 추첨으로 한 명을 뽑는다.
 * 떨어졌거나 지망하지 않은 참가자는 남은 인물에 무작위로 배정한다.
 */
export function castRoles(
  characterIds: readonly string[],
  wishes: readonly { key: string; wish: string }[],
  random: () => number = Math.random,
): CastingResult {
  const assigned = new Map<string, string>();
  const lotteries: CastingResult["lotteries"] = [];
  for (const id of characterIds) {
    const wishers = wishes.filter((w) => w.wish === id).map((w) => w.key);
    if (wishers.length === 0) continue;
    const winner = wishers[Math.floor(random() * wishers.length)] as string;
    assigned.set(winner, id);
    if (wishers.length > 1) lotteries.push({ characterId: id, wishers, winner });
  }
  const taken = new Set(assigned.values());
  const left = shuffle(
    characterIds.filter((id) => !taken.has(id)),
    random,
  );
  const rest = shuffle(
    wishes.filter((w) => !assigned.has(w.key)),
    random,
  );
  for (const w of rest) {
    const next = left.shift();
    if (!next) break;
    assigned.set(w.key, next);
  }
  return { assigned, lotteries };
}
