import { describe, expect, it } from "vitest";
import { WhisperBook, whisperLimits } from "./whisper.js";

const seated = ["a", "b", "c", "d", "e"];
const book = (config?: Parameters<typeof whisperLimits>[0]) =>
  new WhisperBook(whisperLimits(config), () => 1000);

function open(b: WhisperBook, from: string, targets: string[]) {
  const r = b.invite(from, targets, seated);
  if (!r.ok) throw new Error(r.error);
  return r.value.whisper;
}

describe("whisperLimits", () => {
  it("설정이 없으면 3인, 시간·횟수 제한 없음", () => {
    expect(whisperLimits()).toEqual({ maxParticipants: 3, maxDurationSec: 0, maxPerPlayer: 0 });
  });
  it("인원은 2~3인으로 자른다", () => {
    expect(whisperLimits({ maxParticipants: 2 }).maxParticipants).toBe(2);
    expect(whisperLimits({ maxParticipants: 5 }).maxParticipants).toBe(3);
  });
});

describe("WhisperBook", () => {
  it("초대받은 사람이 수락하면 밀담이 열리고 제한 시간이 정해진다", () => {
    const b = book({ maxDurationSec: 180 });
    const w = open(b, "a", ["b"]);
    expect(w.startedAt).toBe(0);
    const r = b.respond("b", w.id, true);
    expect(r.ok && r.value.started).toBe(true);
    expect(w.members).toEqual(["a", "b"]);
    expect(w.endsAt).toBe(1000 + 180_000);
  });

  it("본인 포함 3인을 넘게 초대할 수 없다", () => {
    const b = book();
    const r = b.invite("a", ["b", "c", "d"], seated);
    expect(r.ok).toBe(false);
    const w = open(b, "a", ["b", "c"]);
    expect(b.invite("a", ["d"], seated, w.id).ok).toBe(false);
  });

  it("시나리오가 2인으로 정하면 한 명만 부를 수 있다", () => {
    const b = book({ maxParticipants: 2 });
    expect(b.invite("a", ["b", "c"], seated).ok).toBe(false);
    expect(b.invite("a", ["b"], seated).ok).toBe(true);
  });

  it("자기 자신이나 자리에 없는 인물은 초대할 수 없다", () => {
    const b = book();
    expect(b.invite("a", ["a"], seated).ok).toBe(false);
    expect(b.invite("a", ["z"], seated).ok).toBe(false);
  });

  it("다른 밀담 중인 사람은 초대할 수 없다", () => {
    const b = book();
    const w = open(b, "a", ["b"]);
    b.respond("b", w.id, true);
    expect(b.invite("c", ["b"], seated).ok).toBe(false);
  });

  it("이미 밀담 중이면 새 밀담을 신청할 수 없다", () => {
    const b = book();
    open(b, "a", ["b"]);
    expect(b.invite("a", ["c"], seated).ok).toBe(false);
  });

  it("초대만 보내 둔 상태에서 다른 초대를 수락하면 보내 둔 밀담은 사라진다", () => {
    const b = book();
    const first = open(b, "a", ["b"]);
    const second = open(b, "c", ["a"]);
    const r = b.respond("a", second.id, true);
    expect(r.ok && r.value.left?.ended).toBe(true);
    expect(b.whispers.has(first.id)).toBe(false);
    expect(b.memberOf("a")?.id).toBe(second.id);
  });

  it("모두 거절하면 밀담이 열리지 않고 사라진다", () => {
    const b = book();
    const w = open(b, "a", ["b", "c"]);
    expect(b.respond("b", w.id, false).ok).toBe(true);
    expect(b.whispers.has(w.id)).toBe(true);
    const r = b.respond("c", w.id, false);
    expect(r.ok && r.value.ended).toBe(true);
    expect(b.whispers.size).toBe(0);
  });

  it("셋 중 한 명이 나가도 둘이 남으면 이어지고, 혼자 남으면 끝난다", () => {
    const b = book();
    const w = open(b, "a", ["b", "c"]);
    b.respond("b", w.id, true);
    b.respond("c", w.id, true);
    const first = b.leave("c", w.id);
    expect(first.ok && first.value.ended).toBe(false);
    const second = b.leave("b", w.id);
    expect(second.ok && second.value.ended).toBe(true);
    expect(b.memberOf("a")).toBeUndefined();
  });

  it("페이즈당 열 수 있는 밀담 수를 지킨다 (열린 밀담만 센다)", () => {
    const b = book({ maxPerPlayer: 1 });
    const declined = open(b, "a", ["b"]);
    b.respond("b", declined.id, false);
    const w = open(b, "a", ["b"]);
    b.respond("b", w.id, true);
    b.leave("a", w.id);
    expect(b.invite("a", ["c"], seated).ok).toBe(false);
    // 초대받아 들어가는 것은 횟수에 들지 않는다
    const other = open(b, "c", ["a"]);
    expect(b.respond("a", other.id, true).ok).toBe(true);
    b.reset(whisperLimits({ maxPerPlayer: 1 }));
    expect(b.whispers.size).toBe(0);
    expect(b.invite("a", ["c"], seated).ok).toBe(true);
  });

  it("받지 않은 초대에는 답할 수 없다", () => {
    const b = book();
    const w = open(b, "a", ["b"]);
    expect(b.respond("c", w.id, true).ok).toBe(false);
  });
});
