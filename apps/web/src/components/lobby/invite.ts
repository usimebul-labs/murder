/** 초대 링크(…/play/<id>?room=…) 또는 방 코드만 받은 경우 모두 /play 경로로 바꾼다 */
export function resolveInvite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const url = new URL(v, "https://invite.local");
    const room = url.searchParams.get("room");
    if (url.pathname.startsWith("/play/") && room && /^[\w-]{4,64}$/.test(room)) {
      return `${url.pathname}?room=${encodeURIComponent(room)}`;
    }
  } catch {
    // 링크가 아니면 방 코드로 본다
  }
  return /^[\w-]{4,64}$/.test(v) ? `/play/sample?room=${encodeURIComponent(v)}` : null;
}
