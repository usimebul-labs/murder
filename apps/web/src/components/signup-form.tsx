"use client";

import { Calendar, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { AuthField, ErrorAlert, emailError, PasswordField } from "@/components/auth-fields";
import { createClient } from "@/lib/supabase/client";

const SIGNUP_ERRORS: Record<string, string> = {
  user_already_exists: "이미 가입된 이메일이에요.",
  email_exists: "이미 가입된 이메일이에요.",
  weak_password: "영문, 숫자 포함 8자 이상 입력해 주세요.",
  over_email_send_rate_limit: "메일을 너무 많이 보냈어요. 잠시 후 다시 시도해 주세요.",
};
const GENERIC_SIGNUP_ERROR = "가입하지 못했어요. 다시 시도해 주세요.";

const isValidPassword = (value: string) =>
  value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

function passwordError(value: string) {
  if (!value) return "비밀번호를 입력해 주세요.";
  if (!isValidPassword(value)) return "영문, 숫자 포함 8자 이상 입력해 주세요.";
  return undefined;
}

function nicknameError(value: string) {
  if (!value) return "닉네임을 입력해 주세요.";
  if (value.length < 2) return "2자 이상 입력해 주세요.";
  if (!/^[가-힣A-Za-z0-9_]+$/.test(value)) return "한글, 영문, 숫자, 밑줄만 쓸 수 있어요.";
  return undefined;
}

function birthError(value: string) {
  if (!value) return "생년월일을 입력해 주세요.";
  const match = value.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!match) return "YYYY.MM.DD 형식으로 입력해 주세요.";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const now = new Date();
  if (date.getMonth() !== month - 1 || date.getDate() !== day || year < 1900 || date > now) {
    return "올바른 날짜가 아니에요.";
  }
  let age = now.getFullYear() - year;
  if (now < new Date(now.getFullYear(), month - 1, day)) age--;
  if (age < 14) return "만 14세 미만은 가입할 수 없어요.";
  return undefined;
}

function formatBirth(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 6) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
  if (digits.length > 4) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return digits;
}

function passwordStrength(value: string) {
  return value.length >= 12 || /[^A-Za-z0-9]/.test(value) ? 3 : 2;
}

function Consent({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="nm-check">
      <input
        type="checkbox"
        className="nm-check__box"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="nm-check__text">
        <span>{label}</span>
        {description && <span className="nm-check__desc">{description}</span>}
      </span>
    </label>
  );
}

export function SignupForm({ next, onSent }: { next: string; onSent: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [nickname, setNickname] = useState("");
  const [birth, setBirth] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const show = (field: string) => submitted || touched[field];
  const touch = (field: string) => () => setTouched((prev) => ({ ...prev, [field]: true }));
  const againError = !passwordAgain
    ? "비밀번호를 한 번 더 입력해 주세요."
    : passwordAgain !== password
      ? "비밀번호가 일치하지 않아요."
      : undefined;

  const errors = {
    email: emailError(email),
    password: passwordError(password),
    again: againError,
    nickname: nicknameError(nickname),
    birth: birthError(birth),
  };
  const termsMissing = !(terms && privacy);
  const strength = passwordStrength(password);
  const barColor = (bar: number) => (strength >= bar ? "var(--primary)" : "var(--border)");

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.values(errors).some(Boolean) || termsMissing) return;

    setPending(true);
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);
    const agreedAt = new Date().toISOString();
    const { data, error: signUpError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo.toString(),
        // 생년월일은 만 14세 확인에만 쓰고 저장하지 않는다
        data: {
          nickname,
          terms_agreed_at: agreedAt,
          privacy_agreed_at: agreedAt,
          marketing_opt_in: marketing,
        },
      },
    });
    setPending(false);
    if (signUpError) {
      setError(SIGNUP_ERRORS[signUpError.code ?? ""] ?? GENERIC_SIGNUP_ERROR);
      return;
    }
    // 이미 인증된 이메일이면 Supabase는 오류 없이 identities가 빈 사용자를 돌려준다
    if (data.user?.identities?.length === 0) {
      setError(SIGNUP_ERRORS.user_already_exists ?? GENERIC_SIGNUP_ERROR);
      return;
    }
    onSent(email);
  }

  return (
    <form onSubmit={signUp} noValidate className="flex flex-col gap-5">
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <AuthField
        id="signup-email"
        label="이메일"
        icon={Mail}
        type="email"
        placeholder="name@example.com"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={touch("email")}
        error={show("email") ? errors.email : undefined}
        hint="가입을 마치면 이 주소로 인증 링크를 보내드려요."
      />

      <PasswordField
        id="signup-password"
        label="비밀번호"
        placeholder="영문·숫자 포함 8자 이상"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onBlur={touch("password")}
        error={show("password") ? errors.password : undefined}
        below={
          isValidPassword(password) ? (
            <div className="flex items-center gap-2.5 pt-0.5">
              <div className="grid flex-1 grid-cols-3 gap-1">
                {[1, 2, 3].map((bar) => (
                  <span
                    key={bar}
                    className="h-[3px] rounded-sm"
                    style={{ background: barColor(bar) }}
                  />
                ))}
              </div>
              <span className="min-w-7 text-right text-xs font-medium text-muted-foreground">
                {strength === 3 ? "강함" : "보통"}
              </span>
            </div>
          ) : undefined
        }
      />

      <PasswordField
        id="signup-password-again"
        label="비밀번호 확인"
        icon={LockKeyhole}
        placeholder="비밀번호 다시 입력"
        autoComplete="new-password"
        value={passwordAgain}
        onChange={(event) => setPasswordAgain(event.target.value)}
        onBlur={touch("again")}
        error={show("again") ? errors.again : undefined}
        hint={!errors.again ? "비밀번호가 일치해요." : undefined}
      />

      <AuthField
        id="signup-nickname"
        label="닉네임"
        icon={UserRound}
        placeholder="게임에서 쓸 이름"
        maxLength={10}
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        onBlur={touch("nickname")}
        error={show("nickname") ? errors.nickname : undefined}
        hint="2~10자 · 한글, 영문, 숫자, 밑줄"
      />

      <AuthField
        id="signup-birth"
        label="생년월일"
        icon={Calendar}
        inputMode="numeric"
        placeholder="YYYY.MM.DD"
        autoComplete="bday"
        value={birth}
        onChange={(event) => setBirth(formatBirth(event.target.value))}
        onBlur={touch("birth")}
        error={show("birth") ? errors.birth : undefined}
        hint="만 14세 이상 가입할 수 있어요."
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-col rounded-md border border-border bg-card px-3.5 py-0.5">
          <div className="font-semibold">
            <Consent
              label="전체 동의"
              checked={terms && privacy && marketing}
              onChange={(checked) => {
                setTerms(checked);
                setPrivacy(checked);
                setMarketing(checked);
              }}
            />
          </div>
          <div className="border-t border-border" />
          <Consent label="[필수] 이용약관 동의" checked={terms} onChange={setTerms} />
          <Consent label="[필수] 개인정보 수집·이용 동의" checked={privacy} onChange={setPrivacy} />
          <Consent
            label="[선택] 마케팅 정보 수신 동의"
            description="이벤트·신규 시나리오 소식을 이메일로 받아요."
            checked={marketing}
            onChange={setMarketing}
          />
        </div>
        {submitted && termsMissing && (
          <p role="alert" className="nm-field__hint nm-field__hint--error">
            필수 약관에 동의해 주세요.
          </p>
        )}
      </div>

      <button
        type="submit"
        className="nm-btn nm-btn--primary nm-btn--lg nm-btn--block"
        disabled={pending}
      >
        {pending && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        가입하기
      </button>
    </form>
  );
}
