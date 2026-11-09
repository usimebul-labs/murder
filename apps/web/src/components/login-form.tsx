"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle, Lock, Mail, MessageCircle } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "kakao" | "google";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GENERIC_ERROR = "로그인하지 못했어요. 다시 시도해 주세요.";
const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
  email_not_confirmed: "이메일 인증을 완료해 주세요.",
};

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

function emailError(value: string) {
  if (!value) return "이메일을 입력해 주세요.";
  if (!EMAIL_RE.test(value)) return "올바른 이메일 형식이 아니에요.";
  return undefined;
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="nm-field__hint nm-field__hint--error">
      {message}
    </p>
  );
}

export function LoginForm({ next, initialError }: { next: string; initialError: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState<Provider | "email" | null>(null);
  const [error, setError] = useState(initialError ? GENERIC_ERROR : "");

  const shownEmailError = emailTouched || submitted ? emailError(email) : undefined;
  const shownPasswordError = submitted && !password ? "비밀번호를 입력해 주세요." : undefined;

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (emailError(email) || !password) return;

    setPending("email");
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setPending(null);
      setError(AUTH_ERRORS[signInError.code ?? ""] ?? GENERIC_ERROR);
      return;
    }
    window.location.assign(next);
  }

  async function signInWithProvider(provider: Provider) {
    setPending(provider);
    setError("");
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);
    const { error: signInError } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo.toString(), scopes: SCOPES[provider] },
    });
    if (signInError) {
      setPending(null);
      setError(GENERIC_ERROR);
    }
  }

  return (
    <>
      <form onSubmit={signInWithPassword} noValidate className="flex flex-col gap-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-foreground"
            style={{
              borderColor: "var(--accused-border)",
              background: "var(--accused-surface)",
              font: "var(--type-body-sm)",
            }}
          >
            <CircleAlert
              size={16}
              className="mt-0.5 flex-none text-[var(--destructive-text)]"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        )}

        <div className="nm-field">
          <label htmlFor="login-email" className="nm-field__label">
            이메일
          </label>
          <div className="nm-input-wrap">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="login-email"
              className="nm-input nm-input--with-icon"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setEmailTouched(true)}
              aria-invalid={Boolean(shownEmailError)}
              aria-describedby={shownEmailError ? "login-email-error" : undefined}
            />
          </div>
          {shownEmailError && <FieldError id="login-email-error" message={shownEmailError} />}
        </div>

        <div className="nm-field">
          <label htmlFor="login-password" className="nm-field__label">
            비밀번호
          </label>
          <div className="nm-input-wrap">
            <Lock
              size={16}
              className="pointer-events-none absolute left-3 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="login-password"
              className="nm-input nm-input--with-icon"
              style={{ paddingRight: 44 }}
              type={showPassword ? "text" : "password"}
              placeholder="비밀번호"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(shownPasswordError)}
              aria-describedby={shownPasswordError ? "login-password-error" : undefined}
            />
            <button
              type="button"
              className="nm-iconbtn"
              style={{ position: "absolute", top: 0, right: 0 }}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>
          {shownPasswordError && (
            <FieldError id="login-password-error" message={shownPasswordError} />
          )}
        </div>

        <button
          type="submit"
          className="nm-btn nm-btn--primary nm-btn--lg nm-btn--block"
          disabled={pending !== null}
        >
          {pending === "email" && (
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          )}
          입장
        </button>
      </form>

      <div className="flex flex-col gap-4">
        <div
          className="flex items-center gap-3 text-muted-foreground"
          style={{ font: "var(--type-label)" }}
        >
          <span className="h-px flex-1 bg-border" />
          <span>또는 간편 로그인</span>
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
              disabled={pending !== null}
              onClick={() => signInWithProvider(key)}
              className="flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-border-strong bg-transparent px-0.5 py-2 text-foreground transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
            >
              {logo}
              <span className="text-xs font-medium whitespace-nowrap text-muted-foreground">
                {name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
