import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

/** 소셜 로그인 후 돌아오는 주소. 인증 코드를 세션으로 바꾼다 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "1");
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}
