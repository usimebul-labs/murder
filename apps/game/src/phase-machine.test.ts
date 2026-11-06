import { describe, expect, it } from "vitest";
import { createPhaseActor } from "./phase-machine.js";

describe("phaseMachine", () => {
  it("대기실 → 페이즈 순서대로 → 종료", () => {
    const actor = createPhaseActor(3);
    expect(actor.getSnapshot().value).toBe("lobby");
    actor.send({ type: "ADVANCE" });
    expect(actor.getSnapshot().value).toBe("lobby");
    actor.send({ type: "START" });
    expect(actor.getSnapshot().context.phaseIndex).toBe(0);
    actor.send({ type: "ADVANCE" });
    actor.send({ type: "ADVANCE" });
    expect(actor.getSnapshot().context.phaseIndex).toBe(2);
    actor.send({ type: "ADVANCE" });
    expect(actor.getSnapshot().status).toBe("done");
  });
});
