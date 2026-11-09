"use client";

import { Button } from "@mm/ui";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "kakao" | "google";

const ERROR_MESSAGE = "로그인에 실패했습니다. 다시 시도해 주십시오.";

/** Supabase에서 Kakao 제공자를 켜면 true로 바꾼다 */
const KAKAO_ENABLED = false;

/** 카카오는 비즈 앱에서만 이메일 동의 항목을 쓸 수 있어 닉네임과 프로필 이미지만 요청한다 */
const SCOPES: Partial<Record<Provider, string>> = {
  kakao: "profile_nickname profile_image",
};

export function LoginButtons({ next, initialError }: { next: string; initialError: boolean }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState(initialError);

  async function signIn(provider: Provider) {
    setPending(provider);
    setError(false);
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);
    const { error: signInError } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo.toString(), scopes: SCOPES[provider] },
    });
    if (signInError) {
      setPending(null);
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {KAKAO_ENABLED && (
        <Button
          className="bg-[#FEE500] text-black/85 hover:bg-[#FDD800]"
          disabled={pending !== null}
          onClick={() => signIn("kakao")}
        >
          카카오로 로그인
        </Button>
      )}
      <Button variant="secondary" disabled={pending !== null} onClick={() => signIn("google")}>
        Google로 로그인
      </Button>
      {error && <p className="text-sm text-[var(--destructive-text)]">{ERROR_MESSAGE}</p>}
    </div>
  );
}
