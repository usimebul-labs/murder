"use client";

import type { ClueCategory, PhaseKind } from "@mm/scenario-schema";
import { cn } from "@mm/ui";
import {
  CircleAlert,
  Ear,
  Fingerprint,
  Hourglass,
  type LucideIcon,
  MessageCircle,
  ScrollText,
  Sparkles,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import type { CharacterInfo, ClueCardInfo, ClueInfo } from "./types";
import type { Toast } from "./use-game";

/** 시나리오 이미지 키 → 정적 경로. 데모 이미지는 public/scenarios 아래에 둔다 */
export const asset = (key?: string) => (key ? `/${key}` : undefined);

export const CATEGORY: Record<ClueCategory, { label: string; icon: LucideIcon }> = {
  physical: { label: "물증", icon: Fingerprint },
  document: { label: "문서", icon: ScrollText },
  testimony: { label: "증언", icon: MessageCircle },
  hearsay: { label: "소문", icon: Ear },
};

/** 페이즈 종류별 강조색 */
export function phaseTone(kind?: PhaseKind | "lobby") {
  switch (kind) {
    case "investigation":
      return "var(--phase-explore)";
    case "discussion":
    case "final-statements":
      return "var(--phase-discuss)";
    case "vote":
      return "var(--phase-vote)";
    case "objectives-review":
    case "ending":
      return "var(--phase-ending)";
    default:
      return "var(--primary)";
  }
}

export function useNow(intervalMs = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Countdown({
  endsAt,
  label,
  tone = "var(--primary)",
  className,
}: {
  endsAt: number;
  label?: string;
  tone?: string;
  className?: string;
}) {
  const now = useNow();
  if (!endsAt) return null;
  const left = endsAt - now;
  const urgent = left < 30_000;
  return (
    <span
      role="timer"
      aria-label={`${label ?? "남은 시간"} ${formatClock(left)}`}
      className={cn(
        "inline-flex h-9 flex-none items-center gap-2 rounded-full border px-3 font-mono text-[15px] font-bold tracking-[0.04em]",
        urgent && "animate-[nm-tick_1s_ease-in-out_infinite]",
        className,
      )}
      style={{
        color: urgent ? "var(--destructive-text)" : tone,
        borderColor: urgent
          ? "var(--accused-border)"
          : `color-mix(in oklch, ${tone} 55%, transparent)`,
        background: `color-mix(in oklch, ${tone} 10%, transparent)`,
      }}
    >
      <Hourglass size={14} aria-hidden />
      {label && <span className="font-sans text-xs font-semibold tracking-normal">{label}</span>}
      {formatClock(left)}
    </span>
  );
}

export function Eyebrow({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <p
      className={cn("font-mono text-xs font-bold uppercase tracking-[0.14em]", className)}
      style={{ color: tone ?? "var(--muted-foreground)" }}
    >
      {children}
    </p>
  );
}

/** 화면 상단 고정 헤더: 아이브로우 + 제목 + 오른쪽 도구 */
export function TopBar({
  eyebrow,
  title,
  tone,
  right,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  tone?: string;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 flex-none items-center justify-between gap-3 border-b border-border bg-[color-mix(in_oklch,var(--background)_92%,transparent)] px-4 backdrop-blur-[6px]">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span
          className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: tone ?? "var(--primary)" }}
        >
          {eyebrow}
        </span>
        <span className="truncate font-serif text-[15px] font-bold leading-tight">{title}</span>
      </div>
      <div className="flex flex-none items-center gap-2">{right}</div>
    </header>
  );
}

export function Portrait({
  character,
  className,
  dim,
}: {
  character?: CharacterInfo;
  className?: string;
  dim?: boolean;
}) {
  const src = asset(character?.portraitKey);
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[var(--ink-800)]",
        dim && "opacity-45 grayscale",
        className,
      )}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: 시나리오 이미지는 정적 SVG라 next/image 최적화가 필요 없다
        <img
          src={src}
          alt={character ? `${character.name} 초상` : ""}
          className="h-full w-full object-cover [filter:grayscale(.25)_sepia(.2)]"
          draggable={false}
        />
      ) : (
        <span className="grid h-full w-full place-items-center font-display text-3xl text-muted-foreground">
          {character?.name.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

/** 원형 인물 표식: 초상 얼굴 부분 + 캐릭터 색 테두리 */
export function Avatar({
  character,
  size = 36,
  ring,
  dim,
  className,
}: {
  character?: CharacterInfo;
  size?: number;
  ring?: string;
  dim?: boolean;
  className?: string;
}) {
  const color = character ? `var(--char-${character.colorIndex})` : "var(--border-strong)";
  const src = asset(character?.portraitKey);
  return (
    <span
      className={cn(
        "relative inline-grid flex-none place-items-center overflow-hidden rounded-full bg-[var(--ink-800)]",
        dim && "opacity-50 grayscale",
        className,
      )}
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 ${size > 48 ? 2 : 1.5}px ${ring ?? color}`,
      }}
      title={character?.name}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: 정적 SVG 초상
        <img
          src={src}
          alt=""
          className="h-[135%] w-[135%] max-w-none object-cover object-[50%_20%] [filter:grayscale(.25)_sepia(.2)]"
          draggable={false}
        />
      ) : (
        <span className="font-serif font-bold" style={{ color, fontSize: size * 0.42 }}>
          {character?.name.slice(0, 1) ?? "?"}
        </span>
      )}
    </span>
  );
}

export function CharacterName({ character, me }: { character?: CharacterInfo; me?: boolean }) {
  if (!character) return <span className="text-muted-foreground">관전자</span>;
  return (
    <span className="font-semibold" style={{ color: `var(--char-${character.colorIndex})` }}>
      {character.name}
      {me && <span className="ml-1 text-xs font-normal text-muted-foreground">(나)</span>}
    </span>
  );
}

export function CategoryBadge({
  category,
  className,
}: {
  category: ClueCategory;
  className?: string;
}) {
  const meta = CATEGORY[category];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-[2px] bg-[var(--paper-ink)] px-1.5 text-[11px] font-semibold text-[var(--paper-50)]",
        className,
      )}
    >
      <Icon size={11} aria-hidden />
      {meta.label}
    </span>
  );
}

/**
 * 단서 카드. 내용을 볼 수 없으면(clue 없음) 뒤집힌 앞면만 보인다: 분류, 출처, 코드.
 */
export function ClueCard({
  card,
  clue,
  holder,
  footer,
  onClick,
  selected,
  highlight,
  compact,
  className,
}: {
  card?: ClueCardInfo;
  clue?: ClueInfo;
  holder?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  highlight?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const category = clue?.category ?? card?.category ?? "physical";
  const code = clue?.code ?? card?.code ?? "";
  const source = clue?.source ?? card?.source ?? "";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "nm-paper-lines group relative flex flex-col overflow-hidden rounded-[6px] border text-left text-[var(--paper-ink)] shadow-[var(--shadow-paper)] transition-[transform,box-shadow,border-color] duration-200",
        "border-[var(--paper-rule)] bg-[var(--paper-surface)]",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-[var(--brass-500)]",
        selected && "border-[var(--brass-400)] shadow-[var(--glow-candle)] -translate-y-0.5",
        highlight && "shadow-[var(--glow-candle)]",
        className,
      )}
    >
      {clue?.imageKey && !compact && (
        // biome-ignore lint/performance/noImgElement: 정적 SVG 단서 이미지
        <img
          src={asset(clue.imageKey)}
          alt=""
          className="aspect-[3/2] w-full border-b border-[var(--paper-rule)] object-cover [filter:grayscale(.3)_sepia(.25)]"
          draggable={false}
        />
      )}
      <div className={cn("flex flex-1 flex-col gap-1.5", compact ? "p-2.5" : "p-3")}>
        <div className="flex items-center justify-between gap-2">
          <CategoryBadge category={category} />
          <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--paper-ink-muted)]">
            {code}
          </span>
        </div>
        {clue ? (
          <>
            <p className="text-xs text-[var(--paper-ink-muted)]">{source}</p>
            <p
              className={cn(
                "font-serif font-bold leading-snug",
                compact ? "text-[15px]" : "text-base",
              )}
            >
              {clue.title}
            </p>
            {!compact && <p className="text-sm leading-relaxed">{clue.body}</p>}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[var(--paper-ink-muted)]">
            {(() => {
              const Icon = CATEGORY[category].icon;
              return <Icon size={compact ? 20 : 26} aria-hidden />;
            })()}
            <span className="text-xs">{source}</span>
          </div>
        )}
        {(holder || footer) && (
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--paper-rule)] pt-2 text-xs">
            {holder}
            {footer}
          </div>
        )}
      </div>
    </Tag>
  );
}

/** 수사 메모. 이 브라우저에만 저장된다 */
export function Notes({ storageKey, className }: { storageKey: string; className?: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    try {
      setText(localStorage.getItem(storageKey) ?? "");
    } catch {}
  }, [storageKey]);
  return (
    <div
      className={cn(
        "flex flex-col rounded-[6px] border border-[var(--paper-rule)] bg-[var(--paper-surface)] text-[var(--paper-ink)] shadow-[var(--shadow-paper)]",
        className,
      )}
    >
      <div className="flex items-baseline justify-between px-4 pt-3">
        <label htmlFor={`note-${storageKey}`} className="font-serif text-lg font-bold">
          수사 메모
        </label>
        <span className="font-mono text-[11px] text-[var(--paper-ink-muted)]">
          {text.length}/2000
        </span>
      </div>
      <textarea
        id={`note-${storageKey}`}
        value={text}
        maxLength={2000}
        onChange={(e) => {
          setText(e.target.value);
          try {
            localStorage.setItem(storageKey, e.target.value);
          } catch {}
        }}
        placeholder="떠오르는 의문, 엇갈리는 증언, 확인할 시각을 적어 두세요."
        className="nm-note-lines min-h-40 flex-1 resize-none bg-transparent px-4 pb-4 pt-1 font-mono text-sm leading-7 outline-none placeholder:text-[var(--paper-ink-muted)]"
      />
      <p className="border-t border-dashed border-[var(--paper-rule)] px-4 py-2 text-[11px] text-[var(--paper-ink-muted)]">
        메모는 나만 볼 수 있어요. 이 브라우저에 저장돼요.
      </p>
    </div>
  );
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex w-full max-w-sm animate-[nm-fade-up_420ms_var(--ease-quiet)] items-start gap-3 rounded-md border bg-popover px-4 py-3 shadow-[var(--shadow-raised)]",
            t.tone === "clue" &&
              "border-[var(--clue-new-border)] shadow-[var(--shadow-raised),var(--glow-candle)]",
            t.tone === "error" && "border-[var(--accused-border)]",
            t.tone === "info" && "border-border-strong",
          )}
        >
          <span
            className="mt-0.5"
            style={{
              color:
                t.tone === "clue"
                  ? "var(--clue-new)"
                  : t.tone === "error"
                    ? "var(--destructive-text)"
                    : "var(--foreground)",
            }}
          >
            {t.tone === "error" ? <CircleAlert size={18} /> : <Sparkles size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.desc && <p className="text-sm text-muted-foreground">{t.desc}</p>}
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => onDismiss(t.id)}
            className="-m-1 rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex animate-[nm-fade_220ms] items-end justify-center bg-[var(--overlay)] p-3 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative max-h-[calc(100dvh-24px)] w-full animate-[nm-fade-up_420ms_var(--ease-quiet)] overflow-auto rounded-[6px] border border-border-strong bg-popover shadow-[var(--shadow-modal)]",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="flex flex-col gap-1.5 px-5 pb-3 pt-5 pr-14">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 className="font-serif text-2xl font-bold">{title}</h2>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-md hover:bg-accent"
        >
          <X size={18} />
        </button>
        <div className="px-5 pb-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** 하단 고정 행동 바 (YOUR TURN, MY CHOICE 등) */
export function ActionBar({
  eyebrow,
  title,
  desc,
  children,
  tone,
}: {
  eyebrow: string;
  title: ReactNode;
  desc?: ReactNode;
  children?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="sticky bottom-0 z-20 flex flex-none flex-wrap items-center justify-between gap-3 border-t border-border bg-[color-mix(in_oklch,var(--background)_94%,transparent)] px-4 py-3 backdrop-blur-[6px] sm:px-7">
      <div className="min-w-0">
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        <p className="mt-1 font-serif text-lg font-bold leading-tight">{title}</p>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="flex flex-none items-center gap-2">{children}</div>
    </div>
  );
}

export const btn = {
  base: "inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px",
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary:
    "border border-border bg-secondary text-secondary-foreground hover:border-border-strong hover:bg-accent",
  outline: "border border-border-strong bg-transparent hover:bg-accent",
  ghost: "bg-transparent hover:bg-accent",
  accuse:
    "border border-[var(--oxblood-400)] bg-[var(--accused-solid)] font-display uppercase tracking-[0.14em] text-[var(--paper-50)] hover:bg-[var(--oxblood-500)] hover:shadow-[var(--glow-accused)]",
  sm: "h-9 px-3 text-xs",
  lg: "h-[52px] px-6 text-base",
};
