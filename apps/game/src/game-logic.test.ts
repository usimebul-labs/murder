import { sampleScenario, validateScenario } from "@mm/scenario-schema";
import { describe, expect, it } from "vitest";
import { autoUnlockedClues, cluesAtLocation, pickEnding, tallyVotes } from "./game-logic.js";

const result = validateScenario(sampleScenario);
if (!result.ok) throw new Error("샘플 시나리오가 유효하지 않습니다");
const scenario = result.scenario;

describe("game-logic", () => {
  it("조사 페이즈 전에는 장소 단서를 얻을 수 없다", () => {
    expect(cluesAtLocation(scenario, "서재", "butler", 1, new Set())).toHaveLength(0);
    expect(cluesAtLocation(scenario, "서재", "butler", 2, new Set())).toHaveLength(1);
  });

  it("선행 단서를 얻으면 연결된 단서가 해당 캐릭터에게만 풀린다", () => {
    const owned = new Set(["teacup"]);
    expect(autoUnlockedClues(scenario, "writer", 2, owned).map((c) => c.id)).toEqual(["letter"]);
    expect(autoUnlockedClues(scenario, "butler", 2, owned)).toHaveLength(0);
  });

  it("투표 동률이면 지목 실패", () => {
    expect(tallyVotes(["a", "b"])).toBeNull();
    expect(tallyVotes(["a", "a", "b"])).toBe("a");
  });

  it("범인을 지목하면 해결 결말", () => {
    expect(pickEnding(scenario, "niece").id).toBe("solved");
    expect(pickEnding(scenario, "butler").id).toBe("default");
  });
});
