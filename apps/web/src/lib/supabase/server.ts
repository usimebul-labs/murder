import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** 현재 로그인한 사용자. 개발 인증을 쓰거나 Supabase 설정이 없으면 null */
export async function getCurrentUser() {
  if (process.env.NEXT_PUBLIC_DEV_AUTH === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 미들웨어가 세션을 갱신한다.
          }
        },
      },
    },
  );
}
