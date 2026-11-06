import { describe, expect, it } from "vitest";
import { migrateScenario, sampleScenario, validateScenario } from "./index.js";

const clone = () => structuredClone(sampleScenario) as typeof sampleScenario;

describe("validateScenario", () => {
  it("샘플 시나리오는 통과한다", () => {
    const r = validateScenario(sampleScenario);
    expect(r.ok).toBe(true);
  });

  it("범인이 없으면 실패한다", () => {
    const s = clone();
    for (const c of s.characters) c.isCulprit = false;
    const r = validateScenario(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.message.includes("범인"))).toBe(true);
  });

  it("없는 캐릭터를 참조하면 실패한다", () => {
    const s = clone();
    s.clues[1] = { ...s.clues[1], visibility: { kind: "characters", characterIds: ["ghost"] } };
    const r = validateScenario(s);
    expect(r.ok).toBe(false);
  });

  it("단서 해금 순환을 찾는다", () => {
    const s = clone();
    (s.clues[0] as { unlock: { requiresClueIds?: string[] } }).unlock.requiresClueIds = ["letter"];
    const r = validateScenario(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.message.includes("순환"))).toBe(true);
  });
});

describe("migrateScenario", () => {
  it("미래 버전은 거부한다", () => {
    expect(() => migrateScenario({ schemaVersion: 999 })).toThrow();
  });
});
