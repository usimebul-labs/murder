import type { Clue, Ending, Scenario } from "@mm/scenario-schema";

/** 이 캐릭터가 볼 수 있는 단서인지 (시나리오의 공개 대상 규칙) */
export function canSee(clue: Clue, characterId: string): boolean {
  return clue.visibility.kind === "all" || clue.visibility.characterIds.includes(characterId);
}

/** 해금 조건(페이즈 도달, 선행 단서 보유)을 만족하는지 */
export function isUnlocked(
  scenario: Scenario,
  clue: Clue,
  phaseIndex: number,
  ownedClueIds: ReadonlySet<string>,
): boolean {
  if (clue.unlock.phaseId) {
    const required = scenario.phases.findIndex((p) => p.id === clue.unlock.phaseId);
    if (required < 0 || phaseIndex < required) return false;
  }
  return clue.unlock.requiresClueIds.every((id) => ownedClueIds.has(id));
}

/**
 * 조사 없이 자동으로 받는 단서: 장소가 없고, 해금 조건(페이즈 도달·선행 단서)을 만족하며,
 * 이 캐릭터에게 공개되는 단서. 페이즈가 바뀌거나 새 단서를 얻을 때마다 다시 계산한다.
 */
export function autoUnlockedClues(
  scenario: Scenario,
  characterId: string,
  phaseIndex: number,
  ownedClueIds: ReadonlySet<string>,
): Clue[] {
  return scenario.clues.filter(
    (c) =>
      !c.unlock.location &&
      !ownedClueIds.has(c.id) &&
      canSee(c, characterId) &&
      isUnlocked(scenario, c, phaseIndex, ownedClueIds),
  );
}

/** 장소 조사로 얻을 수 있는 단서 */
export function cluesAtLocation(
  scenario: Scenario,
  location: string,
  characterId: string,
  phaseIndex: number,
  ownedClueIds: ReadonlySet<string>,
): Clue[] {
  return scenario.clues.filter(
    (c) =>
      c.unlock.location === location &&
      !ownedClueIds.has(c.id) &&
      canSee(c, characterId) &&
      isUnlocked(scenario, c, phaseIndex, ownedClueIds),
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

/** 지목 결과에 맞는 결말 선택 */
export function pickEnding(scenario: Scenario, accusedCharacterId: string | null): Ending {
  const culpritIds = new Set(scenario.characters.filter((c) => c.isCulprit).map((c) => c.id));
  const caught = accusedCharacterId !== null && culpritIds.has(accusedCharacterId);
  const kind = caught ? "culprit-accused" : "culprit-missed";
  const ending =
    scenario.endings.find((e) => e.condition.kind === kind) ??
    scenario.endings.find((e) => e.condition.kind === "default");
  if (!ending) throw new Error("결말이 없습니다");
  return ending;
}
