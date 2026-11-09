import { type Clue, type Condition, type Scenario, ScenarioSchema } from "./schema.js";

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
  dupes(
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
  if (s.endings.at(-1)?.condition.kind !== "always") {
    add("endings", "마지막 결말은 조건 없는 기본 결말(always)이어야 합니다");
  }

  const locationIds = dupes(
    s.locations.map((l) => l.id),
    "locations",
  );
  const culprits = s.characters.filter((c) => c.isCulprit);
  if (culprits.length > 1)
    add("characters", `범인은 한 명이어야 합니다 (현재 ${culprits.length}명)`);

  const refCharacter = (cid: string, path: string) => {
    if (cid !== "self" && cid !== "anyone" && !characterIds.has(cid))
      add(path, `없는 캐릭터를 참조합니다: ${cid}`);
  };
  const refClue = (cid: string, path: string) => {
    if (!clueIds.has(cid)) add(path, `없는 단서를 참조합니다: ${cid}`);
  };
  const walk = (c: Condition | undefined, path: string) => {
    if (!c) return;
    switch (c.kind) {
      case "clue-collected":
      case "clue-public":
      case "clue-held-by":
        refClue(c.clueId, path);
        if ("by" in c && c.by) refCharacter(c.by, path);
        break;
      case "accused-is":
        for (const cid of c.characterIds) refCharacter(cid, path);
        break;
      case "voted-for":
        for (const cid of c.characterIds) refCharacter(cid, path);
        if (c.by) refCharacter(c.by, path);
        break;
      case "all":
      case "any":
        for (const x of c.of) walk(x, path);
        break;
      case "not":
        walk(c.condition, path);
        break;
    }
  };

  // 라운드: 조사 페이즈의 round는 1부터 빠짐없이 이어져야 한다
  const rounds = s.phases.flatMap((p) => (p.kind === "investigation" ? [p.round] : []));
  rounds.forEach((r, i) => {
    if (r !== i + 1)
      add("phases", `조사 라운드 번호가 1부터 이어지지 않습니다: ${rounds.join(", ")}`);
  });
  const maxRound = rounds.length;
  s.phases.forEach((p, i) => {
    if (p.kind === "discussion" && p.round > maxRound)
      add(`phases.${i}.round`, `토론 ${p.round}라운드에 해당하는 조사 라운드가 없습니다`);
    if (p.kind === "discussion" && p.whisper && !p.allowWhisper)
      add(`phases.${i}.whisper`, "밀담 설정이 있지만 allowWhisper가 꺼져 있습니다");
  });
  if (s.phases.filter((p) => p.kind === "vote").length > 1)
    add("phases", "투표 페이즈는 하나여야 합니다");

  s.characters.forEach((c, i) => {
    for (const r of c.script.relationships)
      refCharacter(r.characterId, `characters.${i}.script.relationships`);
    dupes(
      c.objectives.map((o) => o.id),
      `characters.${i}.objectives`,
    );
    const mains = c.objectives.filter((o) => o.kind === "main").length;
    if (c.objectives.length > 0 && mains !== 1)
      add(`characters.${i}.objectives`, `주 목표는 하나여야 합니다 (현재 ${mains}개)`);
    c.objectives.forEach((o, j) => {
      if (o.judge.kind === "auto") walk(o.judge.condition, `characters.${i}.objectives.${j}.judge`);
    });
  });

  s.clues.forEach((clue, i) => {
    const path = `clues.${i}`;
    if (clue.visibility.kind === "characters") {
      for (const cid of clue.visibility.characterIds) refCharacter(cid, `${path}.visibility`);
    }
    if (clue.distribution === "search") {
      if (!clue.locationId) add(`${path}.locationId`, "조사로 얻는 단서에 장소가 없습니다");
      else if (!locationIds.has(clue.locationId))
        add(`${path}.locationId`, `없는 장소를 참조합니다: ${clue.locationId}`);
      else {
        const loc = s.locations.find((l) => l.id === clue.locationId);
        if (loc && loc.openFromRound > clue.unlock.fromRound)
          add(
            `${path}.unlock.fromRound`,
            `${clue.unlock.fromRound}라운드에는 ${loc.name}이(가) 아직 닫혀 있습니다`,
          );
      }
    }
    if (clue.unlock.fromRound > Math.max(1, maxRound))
      add(`${path}.unlock.fromRound`, `${clue.unlock.fromRound}라운드는 페이즈에 없습니다`);
    walk(clue.unlock.when, `${path}.unlock.when`);
    for (const req of clueDeps(clue))
      if (req === clue.id) add(`${path}.unlock.when`, "자기 자신을 요구합니다");
  });

  s.endings.forEach((e, i) => {
    walk(e.condition, `endings.${i}.condition`);
  });
  if (s.solution) {
    for (const cid of s.solution.keyClueIds) refClue(cid, "solution.keyClueIds");
    s.solution.timeline.forEach((t, i) => {
      for (const cid of t.clueIds) refClue(cid, `solution.timeline.${i}`);
      if (t.locationId && !locationIds.has(t.locationId))
        add(`solution.timeline.${i}`, `없는 장소를 참조합니다: ${t.locationId}`);
    });
  }

  const cycle = findUnlockCycle(s);
  if (cycle) add("clues", `단서 해금 조건이 순환합니다: ${cycle.join(" → ")}`);

  return issues;
}

function findUnlockCycle(s: Scenario): string[] | null {
  const deps = new Map(s.clues.map((c) => [c.id, clueDeps(c)]));
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

/** 단서의 해금 조건이 요구하는 다른 단서 id (순환 검사용) */
export function clueDeps(clue: Clue): string[] {
  const out: string[] = [];
  const walk = (c: Condition | undefined) => {
    if (!c) return;
    if (c.kind === "clue-collected" || c.kind === "clue-public" || c.kind === "clue-held-by")
      out.push(c.clueId);
    if (c.kind === "all" || c.kind === "any") c.of.forEach(walk);
    if (c.kind === "not") walk(c.condition);
  };
  walk(clue.unlock.when);
  return out;
}
