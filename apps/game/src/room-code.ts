import { matchMaker } from "@colyseus/core";

/** 초대 코드 앞부분. 영문 대문자 5자, 읽기 쉬운 단어만 쓴다 */
const WORDS = [
  "RAVEN",
  "MOORS",
  "FROST",
  "CANDL",
  "GHOST",
  "BRASS",
  "ASHES",
  "ROOKS",
  "CROWN",
  "INKWL",
  "LATCH",
  "MANOR",
  "VELVT",
  "EMBER",
  "CLOCK",
  "QUILL",
  "SHADE",
  "TOWER",
  "VAULT",
  "WHIST",
];

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)] as T;

/** 지금 열린 방과 겹치지 않는 초대 코드 (예: RAVEN-0427) */
export async function createRoomCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = `${pick(WORDS)}-${String(Math.floor(Math.random() * 10_000)).padStart(4, "0")}`;
    const taken = await matchMaker.query({ roomId: code });
    if (taken.length === 0) return code;
  }
  throw new Error("초대 코드를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요");
}
