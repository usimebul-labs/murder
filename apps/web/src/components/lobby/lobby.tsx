"use client";

import { cn } from "@mm/ui";
import { BookOpen, ChevronLeft, ChevronRight, KeyRound, LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Theme } from "@/lib/theme";
import { resolveInvite } from "./invite";
import { AvailabilityBadge, Cover, ThemeBadges } from "./theme-meta";

const TABS = [
  { value: "all", label: "전체", test: () => true },
  { value: "4", label: "4인", test: (t: Theme) => t.minPlayers <= 4 && t.maxPlayers >= 4 },
  { value: "56", label: "5~6인", test: (t: Theme) => t.minPlayers <= 6 && t.maxPlayers >= 5 },
  { value: "7", label: "7인 이상", test: (t: Theme) => t.maxPlayers >= 7 },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const AUTOPLAY_MS = 7000;

const caseHref = (t: Theme) => `/cases/${t.id}`;

export function Lobby({ themes, signedIn }: { themes: Theme[]; signedIn: boolean }) {
  const featured = useMemo(() => themes.filter((t) => t.featured), [themes]);
  const fresh = useMemo(() => themes.filter((t) => t.isNew), [themes]);

  const [tab, setTab] = useState<TabValue>("all");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const cases = themes.filter(
    (t) =>
      TABS.find((x) => x.value === tab)?.test(t) &&
      (!query ||
        t.title.toLowerCase().includes(query) ||
        t.place.toLowerCase().includes(query) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query))),
  );

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <LobbyHeader signedIn={signedIn} />
      {featured.length > 0 && <FeaturedBanner themes={featured} />}

      <main
        className={cn(
          "relative z-[2] flex flex-col gap-10 px-4 pb-20 sm:px-[clamp(16px,4vw,48px)]",
          featured.length > 0 ? "-mt-[clamp(60px,9vh,90px)]" : "pt-24",
        )}
      >
        <InviteEntry />

        {fresh.length > 0 && (
          <section className="flex flex-col gap-3.5" aria-labelledby="fresh-heading">
            <h2 id="fresh-heading" className="font-serif text-xl font-bold">
              새로 공개된 사건
            </h2>
            <ul className="grid auto-cols-[minmax(260px,340px)] grid-flow-col gap-3.5 overflow-x-auto px-0.5 pt-1 pb-2.5 [scrollbar-width:thin]">
              {fresh.map((t) => (
                <li key={t.id}>
                  <Link
                    href={caseHref(t)}
                    aria-label={`${t.title} 사건 보기`}
                    className="group relative block aspect-video text-foreground! no-underline! overflow-hidden rounded-[6px] border border-border bg-muted shadow-[var(--shadow-paper)] transition-[transform,border-color] duration-[140ms] hover:-translate-y-0.5 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Cover theme={t} brightness={0.85} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,color-mix(in_oklch,var(--background)_92%,transparent)_100%)]" />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="nm-badge nm-badge--sm nm-badge--caps nm-badge--solid nm-badge--clue-new">
                        NEW
                      </span>
                    </div>
                    <div className="absolute right-3.5 bottom-3 left-3.5 flex flex-col gap-1">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                        {t.year} · {t.place}
                      </span>
                      <span className="font-serif text-base font-bold leading-snug">{t.title}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-4" aria-labelledby="all-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="all-heading" className="font-serif text-xl font-bold">
              모든 사건
            </h2>
            <div className="nm-input-wrap min-w-[200px] flex-[0_1_260px]">
              <Search
                size={16}
                aria-hidden
                className="pointer-events-none absolute left-3 text-muted-foreground"
              />
              <input
                type="search"
                className="nm-input nm-input--with-icon"
                placeholder="사건 검색"
                aria-label="사건 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="nm-tabs" role="tablist" aria-label="인원">
            {TABS.map((x) => (
              <button
                key={x.value}
                type="button"
                role="tab"
                aria-selected={tab === x.value}
                className="nm-tab"
                onClick={() => setTab(x.value)}
              >
                {x.label}
              </button>
            ))}
          </div>

          {cases.length > 0 ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
              {cases.map((t) => (
                <li key={t.id} className="flex">
                  <CaseCard theme={t} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2.5 rounded-[6px] border border-dashed border-border-strong px-4 py-10 text-center text-muted-foreground">
              <Search size={22} aria-hidden />
              <span className="text-sm">조건에 맞는 사건이 없어요.</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function LobbyHeader({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b pr-2 pl-4 transition-[background,border-color] duration-[220ms] sm:pl-[clamp(16px,4vw,48px)]",
        scrolled
          ? "border-border bg-[color-mix(in_oklch,var(--background)_92%,transparent)] backdrop-blur-[6px]"
          : "border-transparent bg-transparent",
      )}
    >
      <Link href="/" className="flex flex-col leading-none text-foreground! no-underline!">
        <span className="font-display text-[19px] font-semibold tracking-[0.08em]">
          MURDER MYSTERY
        </span>
        <span className="mt-1 font-serif text-[10px] font-bold tracking-[0.35em] text-primary">
          머더 미스터리
        </span>
      </Link>
      {signedIn ? (
        <form action="/auth/signout" method="post">
          <button type="submit" className="nm-btn nm-btn--ghost nm-btn--sm">
            로그아웃
          </button>
        </form>
      ) : (
        <Link href="/login" className="nm-btn nm-btn--outline nm-btn--sm">
          로그인
        </Link>
      )}
    </header>
  );
}

function FeaturedBanner({ themes }: { themes: Theme[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const n = themes.length;
  const go = useCallback(
    (i: number) => {
      setIdx(((i % n) + n) % n);
      setTick((x) => x + 1);
    },
    [n],
  );

  // tick이 바뀌면(수동 이동) 자동 넘김 타이머를 처음부터 다시 잰다
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick은 타이머 재시작 신호
  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, n, tick]);

  const cur = themes[idx] ?? themes[0];
  if (!cur) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="추천 사건"
      className="relative h-[clamp(620px,82vh,820px)] overflow-hidden bg-background"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {themes.map((t, i) => (
        <div
          key={t.id}
          aria-hidden
          className="absolute inset-0 transition-opacity duration-[900ms] ease-[var(--ease-quiet)]"
          style={{ opacity: i === idx ? 1 : 0 }}
        >
          <div
            className="absolute inset-0 transition-transform duration-[8000ms] ease-linear motion-reduce:transition-none"
            style={{ transform: i === idx ? "scale(1.06)" : "scale(1)" }}
          >
            <Cover theme={t} brightness={0.78} />
          </div>
        </div>
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,color-mix(in_oklch,var(--background)_70%,transparent)_32%,transparent_68%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--background)_55%,transparent)_0%,transparent_22%,transparent_52%,color-mix(in_oklch,var(--background)_80%,transparent)_80%,var(--background)_100%)]" />

      <div
        className="absolute inset-x-0 bottom-[clamp(170px,22vh,220px)] flex max-w-[720px] flex-col gap-[18px] px-4 sm:px-[clamp(16px,4vw,48px)]"
        aria-live="polite"
      >
        <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-primary">
          CASE · {cur.caseNumber} — {cur.year} · {cur.place}
        </span>
        <h1 className="font-serif text-[clamp(34px,5.6vw,64px)] font-bold leading-[1.12] tracking-[-0.015em] [text-wrap:balance]">
          {cur.title}
        </h1>
        <p className="max-w-[520px] font-serif text-[clamp(15px,1.4vw,17px)] leading-[1.7] [text-wrap:pretty]">
          {cur.hook}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <AvailabilityBadge theme={cur} />
        </div>
        <ThemeBadges theme={cur} />
        <div className="pt-1.5">
          <Link href={caseHref(cur)} className="nm-btn nm-btn--primary nm-btn--lg">
            <BookOpen size={18} aria-hidden /> 사건 열람
          </Link>
        </div>
      </div>

      {n > 1 && (
        <div className="absolute right-4 bottom-[clamp(110px,14vh,150px)] flex items-center gap-3.5 sm:right-[clamp(16px,4vw,48px)] sm:bottom-[clamp(170px,22vh,220px)]">
          <div className="flex gap-1.5" role="tablist" aria-label="배너 선택">
            {themes.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-label={`${i + 1}번째 사건: ${t.title}`}
                onClick={() => go(i)}
                className="flex cursor-pointer py-5"
              >
                <span
                  className="h-0.5 transition-[width,background] duration-[220ms]"
                  style={{
                    width: i === idx ? 40 : 18,
                    background: i === idx ? "var(--primary)" : "var(--border-strong)",
                  }}
                />
              </button>
            ))}
          </div>
          <span className="font-mono text-[13px] text-muted-foreground">
            {idx + 1} / {n}
          </span>
          <div className="flex">
            <button
              type="button"
              className="nm-iconbtn"
              aria-label="이전 사건"
              onClick={() => go(idx - 1)}
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              className="nm-iconbtn"
              aria-label="다음 사건"
              onClick={() => go(idx + 1)}
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** 초대 링크나 방 코드를 받아 그 방으로 보낸다 */
function InviteEntry() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await resolveInvite(value);
    if ("error" in result) {
      setBusy(false);
      return setError(result.error);
    }
    setError(null);
    router.push(result.path);
  };

  return (
    <section
      aria-label="초대받은 방으로 입장"
      className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3.5 self-start rounded-[6px] bg-[color-mix(in_oklch,var(--background)_38%,transparent)] py-4 backdrop-blur-[14px] sm:w-[min(100%,600px)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-full border border-border-strong text-primary">
          <KeyRound size={18} aria-hidden />
        </span>
        <span className="font-serif text-base font-bold whitespace-nowrap">
          초대받은 방으로 입장
        </span>
      </div>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex max-w-[320px] flex-[1_1_260px] items-start gap-2"
      >
        <div className="nm-field min-w-0 flex-1">
          <input
            className="nm-input nm-input--mono"
            placeholder="초대 링크 또는 초대 코드"
            aria-label="초대 링크 또는 초대 코드"
            aria-invalid={!!error}
            aria-describedby={error ? "invite-error" : undefined}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
          {error && (
            <span id="invite-error" className="nm-field__hint nm-field__hint--error">
              {error}
            </span>
          )}
        </div>
        <button type="submit" className="nm-btn nm-btn--primary" aria-busy={busy} disabled={busy}>
          {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
          입장
        </button>
      </form>
    </section>
  );
}

function CaseCard({ theme: t }: { theme: Theme }) {
  return (
    <Link
      href={caseHref(t)}
      aria-label={`${t.title} 사건 보기`}
      className="group flex w-full flex-col overflow-hidden text-foreground! no-underline! rounded-[6px] border border-border bg-card shadow-[var(--shadow-paper)] transition-[transform,border-color] duration-[140ms] hover:-translate-y-0.5 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
        <Cover theme={t} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,color-mix(in_oklch,var(--card)_85%,transparent)_100%)]" />
        <div className="absolute inset-0 flex flex-col justify-between px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-xs tracking-[0.04em] text-muted-foreground">
              CASE · {t.caseNumber}
            </span>
            <AvailabilityBadge theme={t} size="sm" />
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em]">
            {t.year} · {t.place}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
        <div className="font-serif text-lg font-bold leading-[1.35] [text-wrap:pretty]">
          {t.title}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground [text-wrap:pretty]">{t.hook}</p>
        <div className="mt-auto pt-1.5">
          <ThemeBadges theme={t} size="sm" />
        </div>
      </div>
    </Link>
  );
}
