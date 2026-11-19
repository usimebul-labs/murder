import { describe, expect, it } from "vitest";
import { v1Sample } from "./__fixtures__/v1-sample.js";
import {
  type Clue,
  migrateScenario,
  SCHEMA_VERSION,
  sampleScenario,
  toPublicScenario,
  validateScenario,
} from "./index.js";

const clone = () => structuredClone(sampleScenario) as typeof sampleScenario;
const messages = (input: unknown) => {
  const r = validateScenario(input);
  return r.ok ? [] : r.issues.map((i) => i.message);
};

describe("validateScenario", () => {
  it("블랙우드 저택 시나리오는 통과한다", () => {
    expect(messages(sampleScenario)).toEqual([]);
  });

  it("범인이 없으면 실패한다", () => {
    const s = clone();
    for (const c of s.characters) c.isCulprit = false;
    expect(messages(s).some((m) => m.includes("범인"))).toBe(true);
  });

  it("범인이 둘이면 실패한다", () => {
    const s = clone();
    s.characters[0].isCulprit = true;
    expect(messages(s).some((m) => m.includes("한 명"))).toBe(true);
  });

  it("없는 캐릭터를 참조하면 실패한다", () => {
    const s = clone();
    (s.clues[1] as unknown as Clue).visibility = { kind: "characters", characterIds: ["ghost"] };
    expect(messages(s).some((m) => m.includes("ghost"))).toBe(true);
  });

  it("없는 장소, 없는 인물을 찾는다", () => {
    const s = clone();
    const clues = s.clues as unknown as Clue[];
    clues[1].locationId = "attic";
    const person = clues.find((c) => c.characterId);
    if (person) person.characterId = "ghost";
    const m = messages(s);
    expect(m.some((x) => x.includes("attic"))).toBe(true);
    expect(m.some((x) => x.includes("ghost"))).toBe(true);
  });

  it("탐색 단서는 장소 단서와 인물 단서 중 하나여야 한다", () => {
    const none = clone();
    const a = (none.clues as unknown as Clue[]).find((c) => c.id === "ev-04");
    if (a) a.locationId = undefined;
    expect(messages(none).some((m) => m.includes("장소도 인물도"))).toBe(true);
    const both = clone();
    const b = (both.clues as unknown as Clue[]).find((c) => c.id === "ev-04");
    if (b) b.characterId = "henry";
    expect(messages(both).some((m) => m.includes("하나여야"))).toBe(true);
  });

  it("탐색 단서에 해금 조건을 두면 실패한다", () => {
    const s = clone();
    const clue = (s.clues as unknown as Clue[]).find((c) => c.id === "ev-19");
    if (clue) clue.unlock = { fromRound: 3 };
    expect(messages(s).some((m) => m.includes("해금 조건"))).toBe(true);
  });

  it("단서 해금 순환을 찾는다", () => {
    const s = clone();
    const clues = s.clues as unknown as Clue[];
    const common = clues.find((c) => c.id === "ev-p1");
    const auto = clues.find((c) => c.id === "ev-10");
    if (common) common.unlock = { fromRound: 1, when: { kind: "clue-collected", clueId: "ev-10" } };
    if (auto) auto.unlock = { fromRound: 1, when: { kind: "clue-public", clueId: "ev-p1" } };
    expect(messages(s).some((m) => m.includes("순환"))).toBe(true);
  });

  it("주 목표가 없으면 실패한다", () => {
    const s = clone();
    s.characters[0].objectives = s.characters[0].objectives.filter((o) => o.kind !== "main");
    expect(messages(s).some((m) => m.includes("주 목표"))).toBe(true);
  });

  it("기본 결말이 마지막에 없으면 실패한다", () => {
    const s = clone();
    s.endings.reverse();
    expect(messages(s).some((m) => m.includes("기본 결말"))).toBe(true);
  });
});

describe("toPublicScenario", () => {
  it("비밀 정보가 공개분에 섞이지 않는다", () => {
    const r = validateScenario(sampleScenario);
    if (!r.ok) throw new Error("invalid");
    const json = JSON.stringify(toPublicScenario(r.scenario));
    for (const secret of [
      "isCulprit",
      "sealedTruth",
      '"objectives":',
      "4,200",
      "Tinct",
      "solution",
      '"story":',
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe("migrateScenario", () => {
  it("미래 버전은 거부한다", () => {
    expect(() => migrateScenario({ schemaVersion: 999 })).toThrow();
  });

  it("v1 샘플을 현재 버전으로 올리면 검증을 통과한다", () => {
    expect(messages(migrateScenario(v1Sample))).toEqual([]);
  });

  it("v2 시나리오를 올리면 인물 이야기가 빈 목록으로 채워진다", () => {
    const v2 = structuredClone(sampleScenario) as unknown as {
      schemaVersion: number;
      characters: { script: { story?: unknown } }[];
    };
    v2.schemaVersion = 2;
    for (const c of v2.characters) delete c.script.story;
    const up = migrateScenario(v2) as typeof v2;
    expect(up.schemaVersion).toBe(SCHEMA_VERSION);
    expect(up.characters.every((c) => Array.isArray(c.script.story))).toBe(true);
    expect(messages(up)).toEqual([]);
  });

  it("v3 시나리오를 올리면 탐색 단서의 단계 구분이 사라진다", () => {
    const v3 = structuredClone(sampleScenario) as unknown as {
      schemaVersion: number;
      locations: { openFromRound?: number }[];
      clues: { id: string; distribution: string; characterId?: string; unlock?: unknown }[];
    };
    v3.schemaVersion = 3;
    for (const l of v3.locations) l.openFromRound = 2;
    for (const c of v3.clues) {
      if (c.distribution === "search") c.unlock = { fromRound: 3 };
    }
    const up = migrateScenario(v3) as typeof v3;
    expect(up.schemaVersion).toBe(SCHEMA_VERSION);
    expect(up.locations.every((l) => l.openFromRound === undefined)).toBe(true);
    expect(up.clues.filter((c) => c.distribution === "search").every((c) => !c.unlock)).toBe(true);
    expect(up.clues.find((c) => c.id === "ev-10")?.unlock).toBeDefined();
    expect(messages(up)).toEqual([]);
  });

  it("v4 관련 인물 목록은 장소가 없을 때만 인물 단서로 바뀐다", () => {
    const v4 = {
      ...structuredClone(sampleScenario),
      schemaVersion: 4,
      clues: [
        { id: "a", distribution: "search", locationId: "study", characterIds: ["henry"] },
        { id: "b", distribution: "search", characterIds: ["victor", "clara"] },
        { id: "c", distribution: "public", characterIds: [] },
      ],
    };
    const up = migrateScenario(v4) as { clues: Record<string, unknown>[] };
    expect(up.clues).toEqual([
      { id: "a", distribution: "search", locationId: "study" },
      { id: "b", distribution: "search", characterId: "victor" },
      { id: "c", distribution: "public" },
    ]);
  });
});
