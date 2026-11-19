import { sampleScenario, validateScenario } from "@mm/scenario-schema";
import { describe, expect, it } from "vitest";
import {
  autoUnlockedClues,
  boardClues,
  castRoles,
  cluesAboutCharacter,
  cluesAtLocation,
  currentRound,
  type GameFacts,
  pickEnding,
  scoreCharacter,
  tallyVotes,
  topVoted,
  turnSequence,
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
  });

  it("장소는 첫 탐색부터 모든 단서가 열려 있다", () => {
    expect(ids(cluesAtLocation(scenario, "study", "henry", facts()))).toEqual([
      "ev-01",
      "ev-02",
      "ev-03",
      "ev-04",
      "ev-09",
      "ev-17",
      "ev-21",
    ]);
    expect(cluesAtLocation(scenario, "guest-wing", "henry", facts())).toHaveLength(2);
  });

  it("인물별로도 단서를 찾을 수 있다", () => {
    const victor = ids(cluesAboutCharacter(scenario, "victor", "henry", facts()));
    expect(victor).toEqual(["ev-03", "ev-15", "ev-17", "ev-19", "ev-20", "ev-21"]);
    const owned = new Map([["henry", new Set(["ev-19"])]]);
    expect(ids(cluesAboutCharacter(scenario, "victor", "henry", facts({ owned })))).not.toContain(
      "ev-19",
    );
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

  it("탐색 순서는 라운드마다 한 칸씩 밀리고, 수집 횟수만큼 돈다", () => {
    expect(turnSequence(["a", "b", "c"], 1, 1, "seat-rotating")).toEqual(["a", "b", "c"]);
    expect(turnSequence(["a", "b", "c"], 2, 1, "seat-rotating")).toEqual(["b", "c", "a"]);
    expect(turnSequence(["a", "b"], 3, 2, "seat-rotating")).toEqual(["a", "b", "a", "b"]);
  });

  it("보드에는 탐색 단계와 상관없이 모든 탐색 단서가 나온다", () => {
    const board = ids(boardClues(scenario));
    expect(board).toContain("ev-01");
    expect(board).toContain("ev-19");
    expect(board).toContain("ev-23");
    expect(board).not.toContain("ev-p1");
    expect(board).not.toContain("ev-10");
    expect(board).toHaveLength(22);
  });

  it("동표면 최다 득표자를 모두 돌려준다", () => {
    expect(topVoted(["a", "b"])).toEqual(["a", "b"]);
    expect(topVoted(["a", "a", "b"])).toEqual(["a"]);
    expect(topVoted([])).toEqual([]);
  });

  it("목표 결산: 자동 판정, 판정단, 진범 지목 점수", () => {
    const eleanor = scenario.characters.find((c) => c.id === "eleanor");
    const margaret = scenario.characters.find((c) => c.id === "margaret");
    if (!eleanor || !margaret) throw new Error("인물이 없습니다");
    const f = facts({
      round: 3,
      accusedId: "victor",
      votes: new Map([["eleanor", "victor"]]),
      publicClueIds: new Set(["ev-17"]),
      owned: new Map([["margaret", new Set(["ev-22"])]]),
    });
    const e = scoreCharacter(scenario, eleanor, f, () => null);
    expect(e.objectives.map((o) => o.achieved)).toEqual([true, true]);
    expect(e.culpritVote).toBe(true);
    expect(e.total).toBe(4);
    const m = scoreCharacter(scenario, margaret, f, () => true);
    expect(m.objectives.map((o) => o.achieved)).toEqual([true, true]);
    expect(m.total).toBe(3);
  });

  describe("castRoles", () => {
    const chars = ["a", "b", "c", "d"];
    /** 정해진 순서로 값을 내는 난수 */
    const seq = (...values: number[]) => {
      let i = 0;
      return () => values[i++ % values.length] ?? 0;
    };

    it("겹치지 않는 지망은 그대로 배정한다", () => {
      const { assigned, lotteries } = castRoles(chars, [
        { key: "p1", wish: "a" },
        { key: "p2", wish: "b" },
      ]);
      expect(assigned.get("p1")).toBe("a");
      expect(assigned.get("p2")).toBe("b");
      expect(lotteries).toEqual([]);
    });

    it("여러 명이 지망하면 추첨으로 한 명을 뽑고, 떨어진 사람은 남은 인물을 맡는다", () => {
      const wishes = [
        { key: "p1", wish: "a" },
        { key: "p2", wish: "a" },
        { key: "p3", wish: "a" },
        { key: "p4", wish: "" },
      ];
      const { assigned, lotteries } = castRoles(chars, wishes, seq(0.5));
      expect(assigned.get("p2")).toBe("a");
      expect(lotteries).toEqual([{ characterId: "a", wishers: ["p1", "p2", "p3"], winner: "p2" }]);
      const others = ["p1", "p3", "p4"].map((k) => assigned.get(k));
      expect(new Set(others)).toEqual(new Set(["b", "c", "d"]));
    });

    it("누구도 같은 인물을 둘이 맡지 않고, 모두 인물을 받는다", () => {
      for (let n = 0; n < 50; n++) {
        const wishes = ["p1", "p2", "p3", "p4"].map((key) => ({
          key,
          wish: chars[Math.floor(Math.random() * 3)] ?? "",
        }));
        const { assigned } = castRoles(chars, wishes);
        expect(assigned.size).toBe(4);
        expect(new Set(assigned.values()).size).toBe(4);
      }
    });

    it("인물보다 참가자가 많으면 남는 참가자는 배정받지 못한다", () => {
      const wishes = ["p1", "p2", "p3"].map((key) => ({ key, wish: "a" }));
      const { assigned } = castRoles(["a", "b"], wishes);
      expect(assigned.size).toBe(2);
    });
  });
});
