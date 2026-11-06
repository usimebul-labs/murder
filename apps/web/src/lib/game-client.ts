"use client";

import { Client } from "@colyseus/sdk";
import { createClient } from "./supabase/client";

const GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567";

/** 게임 서버 클라이언트. Supabase access token을 인증 토큰으로 사용한다 */
export async function createGameClient(devNickname?: string) {
  const client = new Client(GAME_SERVER_URL);
  if (process.env.NEXT_PUBLIC_DEV_AUTH === "1") {
    client.auth.token = `dev:${devNickname ?? "탐정"}`;
  } else {
    const { data } = await createClient().auth.getSession();
    if (!data.session) throw new Error("로그인이 필요합니다");
    client.auth.token = data.session.access_token;
  }
  return client;
}
