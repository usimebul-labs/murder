"use client";

import type { Room } from "@colyseus/sdk";

/**
 * 사건 상세 화면의 "방 만들기"에서 만든 방 연결을 대기실 화면(/play)으로 넘긴다.
 * 같은 탭 안의 클라이언트 이동이라 모듈 상태가 유지된다.
 * 넘기기 전에 받은 메시지(시나리오 공개 정보 등)는 모아 두었다가 대기실 화면이 다시 적용한다.
 */
type Pending = { room: Room; buffered: [string, unknown][] };
const pending = new Map<string, Pending>();

export function holdRoom(room: Room) {
  const entry: Pending = { room, buffered: [] };
  room.onMessage("*", (type: string | number, message: unknown) => {
    if (pending.get(room.roomId) === entry) entry.buffered.push([String(type), message]);
  });
  pending.set(room.roomId, entry);
}

export function takeHandedOffRoom(roomId: string): Pending | undefined {
  const entry = pending.get(roomId);
  pending.delete(roomId);
  return entry;
}

/** 넘기지 않고 창을 닫으면 방에서 나간다 (아무도 없으면 서버가 방을 정리한다) */
export function dropHeldRoom(roomId: string) {
  const entry = pending.get(roomId);
  pending.delete(roomId);
  void entry?.room.leave();
}
