import { describe, expect, it } from "vitest";
import { botJudgement, botKey, botNickname, botVoteTarget, pickRandom } from "./bots.js";

describe("bots", () => {
  it("봇 자리 키와 이름을 번호로 만든다", () => {
    expect(botKey(2)).toBe("bot-2");
    expect(botNickname(2)).toBe("AI 봇 2");
  });

  it("빈 목록에서는 고르지 않는다", () => {
    expect(pickRandom([])).toBeUndefined();
  });

  it("자기 지목이 막혀 있으면 자신을 빼고 고른다", () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const target = botVoteTarget(["a", "b", "c"], "a", false, () => r);
      expect(target).not.toBe("a");
      expect(["b", "c"]).toContain(target);
    }
  });

  it("자기 지목이 허용되면 자신도 후보다", () => {
    expect(botVoteTarget(["a", "b"], "a", true, () => 0)).toBe("a");
  });

  it("결선 후보가 자기 하나뿐이고 자기 지목이 막혀 있으면 투표하지 않는다", () => {
    expect(botVoteTarget(["a"], "a", false)).toBeUndefined();
  });

  it("판정은 난수로 정한다", () => {
    expect(botJudgement(() => 0.1)).toBe(true);
    expect(botJudgement(() => 0.9)).toBe(false);
  });
});
