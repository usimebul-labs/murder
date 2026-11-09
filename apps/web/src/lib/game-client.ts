"use client";

import { Client } from "@colyseus/sdk";
import type { RoomListing } from "@mm/game-protocol";
import { createClient } from "./supabase/client";

const GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567";

/** 게임 서버 클라이언트. Supabase access token을 인증 토큰으로 사용한다 */
export async function createGameClient(devNickname?: string) {
  const client = new Client(GAME_SERVER_URL);
  if (process.env.NEXT_PUBLIC_DEV_AUTH === "1") {
    // 헤더에는 ASCII만 실을 수 있어 닉네임을 URI 인코딩한다 (서버가 디코딩)
    client.auth.token = `dev:${encodeURIComponent(devNickname ?? "탐정")}`;
  } else {
    const { data } = await createClient().auth.getSession();
    if (!data.session) throw new Error("로그인이 필요합니다");
    client.auth.token = data.session.access_token;
  }
  return client;
}

/** 게임 서버 HTTP 주소 (ws → http, wss → https) */
export function gameHttpUrl() {
  return GAME_SERVER_URL.replace(/^ws/, "http").replace(/\/$/, "");
}

/** 공개 대기실 목록 */
export async function listRooms(scenarioVersionId: string): Promise<RoomListing[]> {
  const res = await fetch(
    `${gameHttpUrl()}/rooms?scenario=${encodeURIComponent(scenarioVersionId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`대기실 목록을 불러오지 못했습니다 (${res.status})`);
  return ((await res.json()) as { rooms: RoomListing[] }).rooms;
}

/** 초대 코드로 방 찾기 (비공개 방 포함). 없으면 null */
export async function findRoom(code: string): Promise<RoomListing | null> {
  const res = await fetch(`${gameHttpUrl()}/rooms/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`방을 확인하지 못했습니다 (${res.status})`);
  return ((await res.json()) as { room: RoomListing | null }).room;
}
