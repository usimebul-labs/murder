const env = process.env;

export const config = {
  port: Number(env.PORT ?? 2567),
  /** 비어 있으면 DB 없이 샘플 시나리오만 사용 (로컬 개발) */
  databaseUrl: env.DATABASE_URL ?? "",
  supabaseUrl: env.SUPABASE_URL ?? "",
  /** 레거시 HS256 JWT 비밀키. 비어 있으면 JWKS(비대칭 키)로 검증 */
  supabaseJwtSecret: env.SUPABASE_JWT_SECRET ?? "",
  /** "1"이면 로컬 개발용 dev:닉네임 토큰 허용. 운영에서는 절대 켜지 않는다 */
  devAuth: env.DEV_AUTH === "1",
  livekit: {
    url: env.LIVEKIT_URL ?? "",
    apiKey: env.LIVEKIT_API_KEY ?? "",
    apiSecret: env.LIVEKIT_API_SECRET ?? "",
  },
  /** "1"이면 방 생성 시 이용권 확인 (결제 도입 후) */
  requireEntitlement: env.REQUIRE_ENTITLEMENT === "1",
} as const;
