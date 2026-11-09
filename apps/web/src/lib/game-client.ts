"use client";

import { Client } from "@colyseus/sdk";
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
