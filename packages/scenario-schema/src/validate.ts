import { type Scenario, ScenarioSchema } from "./schema.js";

export interface ScenarioIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; scenario: Scenario }
  | { ok: false; issues: ScenarioIssue[] };

/**
 * 발행 가능한 시나리오인지 검사한다.
 * 1) 형식 검사 (Zod)  2) 참조·규칙 검사 (id 중복, 존재하지 않는 참조, 순환 해금 등)
 * 스튜디오는 발행 전에, 게임 서버는 로드할 때 같은 함수를 호출한다.
 */
export function validateScenario(input: unknown): ValidationResult {
  const parsed = ScenarioSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }
  const issues = checkRules(parsed.data);
  return issues.length === 0 ? { ok: true, scenario: parsed.data } : { ok: false, issues };
}

function checkRules(s: Scenario): ScenarioIssue[] {
  const issues: ScenarioIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  const dupes = (ids: string[], path: string) => {
    const seen = new Set<string>();
    for (const x of ids) {
      if (seen.has(x)) add(path, `id가 중복되었습니다: ${x}`);
      seen.add(x);
    }
    return seen;
  };
  const characterIds = dupes(
    s.characters.map((c) => c.id),
    "characters",
  );
  const clueIds = dupes(
    s.clues.map((c) => c.id),
    "clues",
  );
  const phaseIds = dupes(
    s.phases.map((p) => p.id),
    "phases",
  );
  dupes(
    s.endings.map((e) => e.id),
    "endings",
  );
  dupes(
    s.clues.map((c) => c.code),
    "clues.code",
  );

  if (s.meta.minPlayers > s.meta.maxPlayers) {
    add("meta.minPlayers", "최소 인원이 최대 인원보다 많습니다");
  }
  if (s.characters.length < s.meta.minPlayers || s.characters.length > s.meta.maxPlayers) {
    add("characters", "캐릭터 수가 인원 범위와 맞지 않습니다");
  }
  if (!s.characters.some((c) => c.isCulprit)) {
    add("characters", "범인으로 지정된 캐릭터가 없습니다");
  }
  if (!s.phases.some((p) => p.kind === "vote")) {
    add("phases", "투표 페이즈가 없습니다");
  }
  if (s.phases.at(-1)?.kind !== "ending") {
    add("phases", "마지막 페이즈는 결말(ending)이어야 합니다");
  }
  if (!s.endings.some((e) => e.condition.kind === "default")) {
    add("endings", "기본(default) 결말이 없습니다");
  }

  s.clues.forEach((clue, i) => {
    if (clue.visibility.kind === "characters") {
      for (const cid of clue.visibility.characterIds) {
        if (!characterIds.has(cid))
          add(`clues.${i}.visibility`, `없는 캐릭터를 참조합니다: ${cid}`);
      }
    }
    if (clue.unlock.phaseId && !phaseIds.has(clue.unlock.phaseId)) {
      add(`clues.${i}.unlock.phaseId`, `없는 페이즈를 참조합니다: ${clue.unlock.phaseId}`);
    }
    for (const req of clue.unlock.requiresClueIds) {
      if (!clueIds.has(req))
        add(`clues.${i}.unlock.requiresClueIds`, `없는 단서를 참조합니다: ${req}`);
      if (req === clue.id) add(`clues.${i}.unlock.requiresClueIds`, "자기 자신을 요구합니다");
    }
  });

  const cycle = findUnlockCycle(s);
  if (cycle) add("clues", `단서 해금 조건이 순환합니다: ${cycle.join(" → ")}`);

  return issues;
}

function findUnlockCycle(s: Scenario): string[] | null {
  const deps = new Map(s.clues.map((c) => [c.id, c.unlock.requiresClueIds]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    const st = state.get(node);
    if (st === "done") return null;
    if (st === "visiting") return [...stack.slice(stack.indexOf(node)), node];
    state.set(node, "visiting");
    stack.push(node);
    for (const next of deps.get(node) ?? []) {
      const found = visit(next);
      if (found) return found;
    }
    stack.pop();
    state.set(node, "done");
    return null;
  };

  for (const clueId of deps.keys()) {
    const found = visit(clueId);
    if (found) return found;
  }
  return null;
}
