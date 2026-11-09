import { describe, expect, it } from "vitest";
import { josa } from "./josa.js";

describe("josa", () => {
  it("받침에 맞는 조사를 붙인다", () => {
    expect(josa("빅터 헤일", "이/가")).toBe("빅터 헤일이");
    expect(josa("클라라 모스", "이/가")).toBe("클라라 모스가");
    expect(josa("1차 탐색", "을/를")).toBe("1차 탐색을");
    expect(josa("오프닝", "을/를")).toBe("오프닝을");
    expect(josa("결말", "을/를")).toBe("결말을");
    expect(josa("EV-01", "을/를")).toBe("EV-01을");
    expect(josa("EV-02", "을/를")).toBe("EV-02를");
    expect(josa("서재", "으로/로")).toBe("서재로");
    expect(josa("식당", "으로/로")).toBe("식당으로");
  });
});
