import { AccessToken } from "livekit-server-sdk";
import { config } from "./config.js";

export const voiceEnabled = () =>
  Boolean(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret);

/**
 * LiveKit 입장 토큰 발급. 게임 서버가 페이즈에 맞춰 권한을 정한다.
 * (예: 투표 중에는 canPublish=false로 전원 음소거)
 */
export async function createVoiceToken(params: {
  roomName: string;
  identity: string;
  name: string;
  canPublish: boolean;
}): Promise<{ url: string; token: string; roomName: string }> {
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: params.identity,
    name: params.name,
    ttl: "2h",
  });
  at.addGrant({
    room: params.roomName,
    roomJoin: true,
    canPublish: params.canPublish,
    canSubscribe: true,
    canPublishData: false,
  });
  return { url: config.livekit.url, token: await at.toJwt(), roomName: params.roomName };
}
