import { ROOM_CODE_PATTERN } from "@mm/game-protocol";
import { findRoom } from "@/lib/game-client";

export type InviteResult = { path: string } | { error: string };

/** 초대 링크(…/play/<id>?room=…)를 /play 경로로 바꾼다. 링크가 아니면 null */
export function inviteLinkPath(raw: string): string | null {
  try {
    const url = new URL(raw.trim(), "https://invite.local");
    const room = url.searchParams.get("room");
    if (url.pathname.startsWith("/play/") && room && /^[\w-]{4,64}$/.test(room)) {
      return `${url.pathname}?room=${encodeURIComponent(room)}`;
    }
  } catch {
    // 링크가 아니다
  }
  return null;
}

/** 초대 코드(RAVEN-0427)로 게임 서버에서 방을 찾아 대기실 경로를 돌려준다 */
export async function resolveRoomCode(raw: string): Promise<InviteResult> {
  const code = raw.trim().toUpperCase();
  if (!code) return { error: "초대 코드를 입력해 주세요." };
  if (!ROOM_CODE_PATTERN.test(code)) return { error: "예: RAVEN-0427 형식으로 입력해 주세요." };
  try {
    const room = await findRoom(code);
    if (!room) return { error: "해당 코드의 방을 찾을 수 없어요." };
    if (room.status !== "waiting") return { error: "이미 게임이 시작된 방이에요." };
    if (room.players >= room.maxPlayers) return { error: "자리가 모두 찬 방이에요." };
    return { path: `/play/${room.scenarioVersionId}?room=${encodeURIComponent(room.code)}` };
  } catch {
    return { error: "게임 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
}

/** 초대 링크나 초대 코드 모두 받는다 */
export async function resolveInvite(raw: string): Promise<InviteResult> {
  const link = inviteLinkPath(raw);
  return link ? { path: link } : resolveRoomCode(raw);
}
