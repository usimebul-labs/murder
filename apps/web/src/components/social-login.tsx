"use client";

import { MessageCircle } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ErrorAlert, GENERIC_AUTH_ERROR } from "@/components/auth-fields";
import { createClient } from "@/lib/supabase/client";

type Provider = "kakao" | "google";

/** Supabase에서 Kakao 제공자를 켜면 true로 바꾼다 */
const KAKAO_ENABLED = false;

/** 카카오는 비즈 앱에서만 이메일 동의 항목을 쓸 수 있어 닉네임과 프로필 이미지만 요청한다 */
const SCOPES: Partial<Record<Provider, string>> = {
  kakao: "profile_nickname profile_image",
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor" aria-hidden="true">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

const SOCIAL: { key: Provider; name: string; logo: ReactNode }[] = [
  ...(KAKAO_ENABLED
    ? [
        {
          key: "kakao" as const,
          name: "카카오",
          logo: <MessageCircle size={22} fill="currentColor" aria-hidden="true" />,
        },
      ]
    : []),
  { key: "google", name: "구글", logo: <GoogleLogo /> },
];

export function SocialLogin({ next, label }: { next: string; label: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn(provider: Provider) {
    setPending(true);
    setFailed(false);
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo.toString(), scopes: SCOPES[provider] },
    });
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center gap-3 text-muted-foreground"
        style={{ font: "var(--type-label)" }}
      >
        <span className="h-px flex-1 bg-border" />
        <span>{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${SOCIAL.length}, minmax(0, 1fr))` }}
      >
        {SOCIAL.map(({ key, name, logo }) => (
          <button
            key={key}
            type="button"
            aria-label={`${name}로 계속하기`}
            disabled={pending}
            onClick={() => signIn(key)}
            className="flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-border-strong bg-transparent px-0.5 py-2 text-foreground transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
          >
            {logo}
            <span className="text-xs font-medium whitespace-nowrap text-muted-foreground">
              {name}
            </span>
          </button>
        ))}
      </div>
      {failed && <ErrorAlert>{GENERIC_AUTH_ERROR}</ErrorAlert>}
    </div>
  );
}
