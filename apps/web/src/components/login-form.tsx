"use client";

import { LoaderCircle, Mail } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  AuthField,
  ErrorAlert,
  emailError,
  GENERIC_AUTH_ERROR,
  PasswordField,
} from "@/components/auth-fields";
import { createClient } from "@/lib/supabase/client";

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
  email_not_confirmed: "이메일 인증을 완료해 주세요.",
};

export function LoginForm({ next, initialError }: { next: string; initialError: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError ? GENERIC_AUTH_ERROR : "");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (emailError(email) || !password) return;

    setPending(true);
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setPending(false);
      setError(AUTH_ERRORS[signInError.code ?? ""] ?? GENERIC_AUTH_ERROR);
      return;
    }
    window.location.assign(next);
  }

  return (
    <form onSubmit={signIn} noValidate className="flex flex-col gap-5">
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <AuthField
        id="login-email"
        label="이메일"
        icon={Mail}
        type="email"
        placeholder="name@example.com"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={() => setEmailTouched(true)}
        error={emailTouched || submitted ? emailError(email) : undefined}
      />

      <PasswordField
        id="login-password"
        label="비밀번호"
        placeholder="비밀번호"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={submitted && !password ? "비밀번호를 입력해 주세요." : undefined}
      />

      <button
        type="submit"
        className="nm-btn nm-btn--primary nm-btn--lg nm-btn--block"
        disabled={pending}
      >
        {pending && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        입장
      </button>
    </form>
  );
}
