"use client";

import { MailCheck } from "lucide-react";
import { useState } from "react";
import { LoginForm } from "@/components/login-form";
import { SignupForm } from "@/components/signup-form";
import { SocialLogin } from "@/components/social-login";

type Tab = "login" | "signup";

const TABS: { value: Tab; label: string }[] = [
  { value: "login", label: "로그인" },
  { value: "signup", label: "회원가입" },
];

function EmailSent({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col gap-2.5 rounded-lg p-[18px] nm-paper-lines"
        style={{
          backgroundColor: "var(--paper-surface)",
          color: "var(--paper-ink)",
          boxShadow: "var(--shadow-paper)",
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{
            font: "var(--type-caps)",
            letterSpacing: "var(--tracking-caps)",
            color: "var(--paper-ink-muted)",
          }}
        >
          <MailCheck size={16} aria-hidden="true" />
          <span>메일 발송 완료</span>
        </div>
        <div className="break-all" style={{ font: "var(--type-mono)" }}>
          {email}
        </div>
        <p style={{ font: "var(--type-body-sm)" }}>
          인증 링크를 보냈어요. 링크를 누르면 가입이 완료돼요. 메일이 없다면 스팸함을 확인해 주세요.
        </p>
      </div>
      <button type="button" className="nm-btn nm-btn--outline nm-btn--block" onClick={onBack}>
        로그인으로
      </button>
    </div>
  );
}

export function AuthCard({ next, initialError }: { next: string; initialError: boolean }) {
  const [tab, setTab] = useState<Tab>("login");
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <EmailSent
        email={sentTo}
        onBack={() => {
          setSentTo(null);
          setTab("login");
        }}
      />
    );
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="로그인/회원가입"
        className="nm-tabs nm-tabs--segmented nm-tabs--fill"
      >
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className="nm-tab"
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "login" ? (
        <LoginForm next={next} initialError={initialError} />
      ) : (
        <SignupForm next={next} onSent={setSentTo} />
      )}

      <SocialLogin next={next} label={tab === "login" ? "또는 간편 로그인" : "또는 간편 가입"} />

      {tab === "login" && (
        <p
          className="flex flex-wrap justify-center gap-2 text-center text-muted-foreground"
          style={{ font: "var(--type-body-sm)" }}
        >
          <span>계정이 없으신가요?</span>
          <button type="button" className="nm-btn nm-btn--link" onClick={() => setTab("signup")}>
            회원가입
          </button>
        </p>
      )}
    </>
  );
}
