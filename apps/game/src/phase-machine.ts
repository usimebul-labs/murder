import { assign, createActor, setup } from "xstate";

/**
 * 방의 진행 상태 머신: 대기실 → 진행(페이즈 0..N-1) → 종료
 * 시나리오마다 페이즈 구성이 달라도 phaseCount만 바꿔 같은 머신을 쓴다.
 */
export const phaseMachine = setup({
  types: {
    context: {} as { phaseIndex: number; phaseCount: number },
    input: {} as { phaseCount: number },
    events: {} as { type: "START" } | { type: "ADVANCE" } | { type: "ABORT" },
  },
  guards: {
    isLastPhase: ({ context }) => context.phaseIndex >= context.phaseCount - 1,
  },
}).createMachine({
  id: "game",
  initial: "lobby",
  context: ({ input }) => ({ phaseIndex: -1, phaseCount: input.phaseCount }),
  states: {
    lobby: {
      on: {
        START: { target: "playing", actions: assign({ phaseIndex: 0 }) },
        ABORT: "finished",
      },
    },
    playing: {
      on: {
        ADVANCE: [
          { guard: "isLastPhase", target: "finished" },
          { actions: assign({ phaseIndex: ({ context }) => context.phaseIndex + 1 }) },
        ],
        ABORT: "finished",
      },
    },
    finished: { type: "final" },
  },
});

export function createPhaseActor(phaseCount: number) {
  return createActor(phaseMachine, { input: { phaseCount } }).start();
}
