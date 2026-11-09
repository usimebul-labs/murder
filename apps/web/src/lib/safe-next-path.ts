/** 로그인 후 돌아갈 경로를 같은 사이트 안으로 제한한다 (오픈 리다이렉트 방지) */
export function safeNextPath(next: string | null | undefined): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
