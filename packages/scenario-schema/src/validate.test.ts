import { describe, expect, it } from "vitest";
import { v1Sample } from "./__fixtures__/v1-sample.js";
import {
  type Clue,
  migrateScenario,
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

  it("없는 장소, 아직 닫힌 장소를 찾는다", () => {
    const s = clone();
    const clues = s.clues as unknown as Clue[];
    clues[1].locationId = "attic";
    const victorRoom = clues.find((c) => c.id === "ev-19");
    if (victorRoom) victorRoom.unlock = { fromRound: 1 };
    const m = messages(s);
    expect(m.some((x) => x.includes("attic"))).toBe(true);
    expect(m.some((x) => x.includes("닫혀"))).toBe(true);
  });

  it("단서 해금 순환을 찾는다", () => {
    const s = clone();
    const clues = s.clues as unknown as Clue[];
    const ev03 = clues.find((c) => c.id === "ev-03");
    if (ev03) ev03.unlock = { fromRound: 1, when: { kind: "clue-collected", clueId: "ev-09" } };
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
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe("migrateScenario", () => {
  it("미래 버전은 거부한다", () => {
    expect(() => migrateScenario({ schemaVersion: 999 })).toThrow();
  });

  it("v1 샘플을 v2로 올리면 검증을 통과한다", () => {
    expect(messages(migrateScenario(v1Sample))).toEqual([]);
  });
});
