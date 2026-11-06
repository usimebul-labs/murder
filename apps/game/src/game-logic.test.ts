import { sampleScenario, validateScenario } from "@mm/scenario-schema";
import { describe, expect, it } from "vitest";
import {
  autoUnlockedClues,
  cluesAtLocation,
  currentRound,
  type GameFacts,
  pickEnding,
  tallyVotes,
} from "./game-logic.js";

const result = validateScenario(sampleScenario);
if (!result.ok) throw new Error("샘플 시나리오가 유효하지 않습니다");
const scenario = result.scenario;

const facts = (over: Partial<GameFacts> = {}): GameFacts => ({
  round: 1,
  owned: new Map(),
  publicClueIds: new Set(),
  ...over,
});
const ids = (clues: { id: string }[]) => clues.map((c) => c.id);

describe("game-logic", () => {
  it("라운드는 지나온 조사 페이즈로 정해진다", () => {
    const explore2 = scenario.phases.findIndex((p) => p.id === "explore-2");
    expect(currentRound(scenario, 0)).toBe(0);
    expect(currentRound(scenario, explore2)).toBe(2);
  });

  it("조사 전에는 장소 단서를 얻을 수 없다", () => {
    expect(cluesAtLocation(scenario, "study", "henry", facts({ round: 0 }))).toHaveLength(0);
    expect(ids(cluesAtLocation(scenario, "study", "henry", facts()))).toEqual([
      "ev-01",
      "ev-02",
      "ev-03",
      "ev-04",
    ]);
  });

  it("장소는 정해진 라운드에 열린다", () => {
    expect(cluesAtLocation(scenario, "guest-wing", "henry", facts({ round: 2 }))).toHaveLength(0);
    expect(cluesAtLocation(scenario, "guest-wing", "henry", facts({ round: 3 }))).toHaveLength(2);
  });

  it("선행 단서를 누군가 얻으면 연결된 단서가 보드에 나타난다", () => {
    const before = ids(cluesAtLocation(scenario, "study", "henry", facts({ round: 2 })));
    expect(before).not.toContain("ev-09");
    const after = ids(
      cluesAtLocation(
        scenario,
        "study",
        "henry",
        facts({ round: 2, owned: new Map([["clara", new Set(["ev-03"])]]) }),
      ),
    );
    expect(after).toContain("ev-09");
  });

  it("공통 자료는 모두에게, 자동 배포 단서는 대상 캐릭터에게만 간다", () => {
    expect(ids(autoUnlockedClues(scenario, "henry", facts()))).toEqual(["ev-p1"]);
    const revealed = facts({ round: 2, publicClueIds: new Set(["ev-09"]) });
    expect(ids(autoUnlockedClues(scenario, "arthur", revealed))).toContain("ev-10");
    expect(ids(autoUnlockedClues(scenario, "henry", revealed))).not.toContain("ev-10");
  });

  it("투표 동률이면 지목 실패", () => {
    expect(tallyVotes(["a", "b"])).toBeNull();
    expect(tallyVotes(["a", "a", "b"])).toBe("a");
  });

  it("지목 결과에 따라 결말이 갈린다", () => {
    expect(pickEnding(scenario, facts({ accusedId: "victor" })).id).toBe("justice");
    expect(pickEnding(scenario, facts({ accusedId: null })).id).toBe("unsolved");
    expect(pickEnding(scenario, facts({ accusedId: "arthur" })).id).toBe("wrong");
  });
});
