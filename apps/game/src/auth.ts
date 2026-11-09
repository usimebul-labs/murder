import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import { config } from "./config.js";

export interface AuthUser {
  userId: string;
  nickname: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Supabase Auth가 발급한 access token을 검증한다 */
export async function verifyToken(token: string): Promise<AuthUser> {
  if (config.devAuth && token.startsWith("dev:")) {
    // 헤더에는 ASCII만 실을 수 있어 클라이언트가 닉네임을 URI 인코딩해 보낸다
    let nickname = token.slice(4);
    try {
      nickname = decodeURIComponent(nickname);
    } catch {}
    nickname ||= "개발자";
    return { userId: `dev-${nickname}`, nickname };
  }
  if (!token) throw new Error("로그인이 필요합니다");

  let payload: JWTPayload;
  if (config.supabaseJwtSecret) {
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(config.supabaseJwtSecret)));
  } else {
    if (!config.supabaseUrl) throw new Error("SUPABASE_URL이 설정되지 않았습니다");
    jwks ??= createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`));
    ({ payload } = await jwtVerify(token, jwks));
  }
  if (!payload.sub) throw new Error("잘못된 토큰입니다");
  const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
  const nickname =
    (typeof meta.nickname === "string" && meta.nickname) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof payload.email === "string" && payload.email.split("@")[0]) ||
    "탐정";
  return { userId: payload.sub, nickname };
}
