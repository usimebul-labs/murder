import { SCHEMA_VERSION } from "./schema.js";

/** 버전 N → N+1 변환 함수 목록. 형식을 바꿀 때 여기에 추가한다. */
const migrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
};

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const slug = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "place";

/**
 * v1 → v2
 * - 캐릭터: privateScript → script.identity, goals → objectives(첫 번째가 주 목표, GM 판정)
 * - 단서: unlock.location(문자열) → locations[] + locationId, requiresClueIds → unlock.when,
 *         unlock.phaseId → 해당 페이즈까지의 조사 라운드 수(fromRound)
 * - 페이즈: whisper → 밀담이 허용된 discussion, 조사 페이즈에 round 번호 부여
 * - 결말: culprit-accused/culprit-missed/default → accused-is / not accused-is / always
 */
function migrateV1toV2(raw: Raw): Raw {
  const characters = arr(raw.characters);
  const culpritIds = characters.filter((c) => c.isCulprit).map((c) => String(c.id));
  const phases = arr(raw.phases);

  let round = 0;
  const roundAt = new Map<string, number>();
  const nextPhases = phases.map((p) => {
    const kind = p.kind === "whisper" ? "discussion" : p.kind;
    if (kind === "investigation") round += 1;
    roundAt.set(String(p.id), Math.max(1, round));
    const base = { ...p, kind };
    if (kind === "investigation") return { ...base, round, pointsPerPlayer: 1, turnOrder: "free" };
    if (kind === "discussion")
      return {
        ...base,
        round: Math.max(1, round),
        allowWhisper: p.kind === "whisper" || !!p.allowWhisper,
      };
    return base;
  });

  const locationNames = new Map<string, string>();
  const clues = arr(raw.clues).map((c) => {
    const unlock = (c.unlock ?? {}) as Raw;
    const requires = Array.isArray(unlock.requiresClueIds)
      ? (unlock.requiresClueIds as string[])
      : [];
    const location = typeof unlock.location === "string" ? unlock.location : undefined;
    if (location) locationNames.set(slug(location), location);
    const when =
      requires.length === 0
        ? undefined
        : requires.length === 1
          ? { kind: "clue-collected", clueId: requires[0] }
          : { kind: "all", of: requires.map((clueId) => ({ kind: "clue-collected", clueId })) };
    const { unlock: _old, ...rest } = c;
    return {
      ...rest,
      category: "physical",
      source: location ?? "공통 자료",
      distribution: location ? "search" : "auto",
      ...(location ? { locationId: slug(location) } : {}),
      unlock: {
        fromRound: typeof unlock.phaseId === "string" ? (roundAt.get(unlock.phaseId) ?? 1) : 1,
        ...(when ? { when } : {}),
      },
    };
  });

  const endings = arr(raw.endings).map((e) => {
    const k = (e.condition as Raw | undefined)?.kind;
    const accused = { kind: "accused-is", characterIds: culpritIds };
    const condition =
      k === "culprit-accused"
        ? accused
        : k === "culprit-missed"
          ? { kind: "not", condition: accused }
          : { kind: "always" };
    return { ...e, condition };
  });
  // 기본 결말은 맨 뒤로
  endings.sort(
    (a, b) => Number(a.condition.kind === "always") - Number(b.condition.kind === "always"),
  );

  return {
    ...raw,
    schemaVersion: 2,
    locations: [...locationNames].map(([id, name], i) => ({
      id,
      name,
      map: { x: (i % 4) * 25, y: Math.floor(i / 4) * 25, w: 25, h: 25 },
      openFromRound: 1,
    })),
    characters: characters.map(({ privateScript, goals, ...c }) => ({
      ...c,
      script: { identity: String(privateScript ?? ""), sealedTruth: { text: "" } },
      objectives: (Array.isArray(goals) ? (goals as string[]) : []).map((text, i) => ({
        id: `goal-${i + 1}`,
        kind: i === 0 ? "main" : "sub",
        text,
        points: i === 0 ? 2 : 1,
        judge: { kind: "gm", prompt: text },
      })),
    })),
    clues,
    phases: nextPhases,
    endings,
  };
}

/**
 * v2 → v3
 * - 캐릭터 비밀 문서에 서술형 이야기(script.story) 추가. 기존 시나리오는 빈 목록으로 시작한다.
 */
function migrateV2toV3(raw: Raw): Raw {
  return {
    ...raw,
    schemaVersion: 3,
    characters: arr(raw.characters).map((c) => {
      const script = (c.script ?? {}) as Raw;
      return {
        ...c,
        script: { ...script, story: Array.isArray(script.story) ? script.story : [] },
      };
    }),
  };
}

/**
 * v3 → v4
 * - 탐색 단서를 단계별로 나누지 않는다: 장소의 openFromRound와 탐색(search) 단서의 unlock을 없앤다.
 *   모든 탐색 단서가 처음부터 보드에 나오고, 단계별로는 수집 개수(pointsPerPlayer)만 제한한다.
 * - 단서에 관련 인물(characterIds)을 추가한다. 기존 시나리오는 빈 목록으로 시작한다.
 */
function migrateV3toV4(raw: Raw): Raw {
  return {
    ...raw,
    schemaVersion: 4,
    locations: arr(raw.locations).map(({ openFromRound: _open, ...l }) => l),
    clues: arr(raw.clues).map((c) => {
      const characterIds = Array.isArray(c.characterIds) ? c.characterIds : [];
      if (c.distribution !== "search" && c.distribution !== undefined) {
        return { ...c, characterIds };
      }
      const { unlock: _unlock, ...rest } = c;
      return { ...rest, characterIds };
    }),
  };
}

/** 저장된 시나리오 JSON을 현재 SCHEMA_VERSION 형식으로 올린다. */
export function migrateScenario(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  let doc = raw as Record<string, unknown>;
  let version = typeof doc.schemaVersion === "number" ? doc.schemaVersion : 1;
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `지원하지 않는 시나리오 버전입니다 (${version} > ${SCHEMA_VERSION}). 서버를 업데이트하세요.`,
    );
  }
  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new Error(`시나리오 마이그레이션이 없습니다: v${version}`);
    doc = step(doc);
    version += 1;
  }
  return doc;
}
