"use client";

import { CircleAlert, Eye, EyeOff, Lock, type LucideIcon } from "lucide-react";
import { type InputHTMLAttributes, type ReactNode, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const GENERIC_AUTH_ERROR = "로그인하지 못했어요. 다시 시도해 주세요.";

export function emailError(value: string) {
  if (!value) return "이메일을 입력해 주세요.";
  if (!EMAIL_RE.test(value)) return "올바른 이메일 형식이 아니에요.";
  return undefined;
}

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
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
      <span>{children}</span>
    </div>
  );
}

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "style"> & {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  hint?: string;
  /** 입력칸 오른쪽에 겹쳐 놓는 버튼. 있으면 글자가 가려지지 않게 여백을 둔다 */
  trailing?: ReactNode;
  below?: ReactNode;
};

export function AuthField({
  id,
  label,
  icon: Icon,
  error,
  hint,
  trailing,
  below,
  ...input
}: AuthFieldProps) {
  const message = error ?? hint;
  return (
    <div className="nm-field">
      <label htmlFor={id} className="nm-field__label">
        {label}
      </label>
      <div className="nm-input-wrap">
        <Icon
          size={16}
          className="pointer-events-none absolute left-3 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={id}
          className="nm-input nm-input--with-icon"
          style={trailing ? { paddingRight: 44 } : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={message ? `${id}-message` : undefined}
          {...input}
        />
        {trailing}
      </div>
      {below}
      {message && (
        <p
          id={`${id}-message`}
          className={error ? "nm-field__hint nm-field__hint--error" : "nm-field__hint"}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function PasswordField({
  icon = Lock,
  ...field
}: Omit<AuthFieldProps, "icon" | "trailing" | "type"> & { icon?: LucideIcon }) {
  const [shown, setShown] = useState(false);
  return (
    <AuthField
      {...field}
      icon={icon}
      type={shown ? "text" : "password"}
      trailing={
        <button
          type="button"
          className="nm-iconbtn"
          style={{ position: "absolute", top: 0, right: 0 }}
          aria-label={shown ? "비밀번호 숨기기" : "비밀번호 표시"}
          onClick={() => setShown((value) => !value)}
        >
          {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
    />
  );
}
