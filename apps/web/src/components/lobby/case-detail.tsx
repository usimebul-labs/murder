"use client";

import { cn } from "@mm/ui";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  DoorClosed,
  DoorOpen,
  Eye,
  Fingerprint,
  Hourglass,
  KeyRound,
  Lock,
  type LucideIcon,
  MessagesSquare,
  Plus,
  Search,
  ShieldCheck,
  Square,
  Target,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { playPath, type Theme, type ThemeDetail, type ThemePhase } from "@/lib/theme";
import { resolveInvite } from "./invite";
import { Cover, ThemeBadges } from "./theme-meta";

const TABS = [
  { value: "prologue", label: "사건 개요" },
  { value: "flow", label: "진행 순서" },
  { value: "cast", label: "등장인물" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const PHASE_STYLE: Record<ThemePhase["kind"], { icon: LucideIcon; color: string; desc: string }> = {
  prologue: {
    icon: BookOpen,
    color: "var(--primary)",
    desc: "사건 개요를 함께 읽고 맡을 인물을 고릅니다. 개인 비밀 문서가 지급됩니다.",
  },
  investigation: {
    icon: Search,
    color: "var(--phase-explore)",
    desc: "장소를 둘러보며 단서를 모읍니다. 찾은 단서는 공개할지 직접 정해요.",
  },
  discussion: {
    icon: MessagesSquare,
    color: "var(--phase-discuss)",
    desc: "알리바이를 맞춰 보고 서로에게 질문합니다. 귓속말도 쓸 수 있어요.",
  },
  statements: {
    icon: MessagesSquare,
    color: "var(--phase-discuss)",
    desc: "한 사람씩 돌아가며 마지막으로 하고 싶은 말을 남깁니다.",
  },
  vote: {
    icon: Target,
    color: "var(--phase-vote)",
    desc: "각자 한 명을 지목합니다. 확정하면 바꿀 수 없습니다.",
  },
  ending: {
    icon: Eye,
    color: "var(--phase-ending)",
    desc: "범인과 모든 인물의 비밀, 그날 밤의 진상이 공개됩니다.",
  },
};

const RULES: { icon: LucideIcon; t: string; d: string }[] = [
  {
    icon: Lock,
    t: "비밀은 나만 볼 수 있습니다",
    d: "내 비밀 문서는 다른 참가자에게 보이지 않아요. 밝힐지는 스스로 정합니다.",
  },
  {
    icon: ShieldCheck,
    t: "범인만 거짓말할 수 있습니다",
    d: "다른 인물은 말하지 않을 수는 있지만, 사실과 다른 말을 해선 안 돼요.",
  },
  {
    icon: Fingerprint,
    t: "단서는 탐색 시간에만",
    d: "토론 중에는 새 단서를 얻을 수 없어요. 탐색 시간을 아껴 쓰세요.",
  },
  {
    icon: Hourglass,
    t: "페이즈는 자동으로 넘어갑니다",
    d: "방장은 모두 준비되면 타이머를 앞당길 수 있어요.",
  },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export function CaseDetail({
  theme,
  detail,
  signedIn,
}: {
  theme: Theme;
  detail: ThemeDetail;
  signedIn: boolean;
}) {
  const [tab, setTab] = useState<Tab>("prologue");
  const play = playPath(theme);

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <DetailHeader signedIn={signedIn} />

      <section className="relative h-[clamp(460px,66vh,640px)] overflow-hidden">
        <Cover theme={theme} brightness={0.78} />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,color-mix(in_oklch,var(--background)_70%,transparent)_36%,transparent_72%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--background)_55%,transparent)_0%,transparent_24%,transparent_50%,color-mix(in_oklch,var(--background)_85%,transparent)_82%,var(--background)_100%)]" />
        <div className="absolute inset-x-0 bottom-[clamp(36px,6vh,64px)] flex max-w-[760px] flex-col gap-4 px-4 sm:px-[clamp(16px,4vw,48px)]">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-primary">
            CASE · {theme.caseNumber} — {theme.year} · {theme.place}
          </span>
          <h1 className="font-serif text-[clamp(32px,5.2vw,60px)] font-bold leading-[1.12] tracking-[-0.015em] [text-wrap:balance]">
            {theme.title}
          </h1>
          <p className="max-w-[540px] font-serif text-[clamp(15px,1.4vw,17px)] leading-[1.7] [text-wrap:pretty]">
            {theme.hook}
          </p>
          <ThemeBadges theme={theme} />
          <div className="flex flex-wrap gap-2 pt-1 lg:hidden">
            <a href="#rooms" className="nm-btn nm-btn--primary nm-btn--lg">
              <DoorOpen size={18} aria-hidden /> 대기실 보기
            </a>
          </div>
        </div>
      </section>

      <main className="grid grid-cols-1 items-start gap-[clamp(28px,4vw,56px)] px-4 pt-2 pb-24 sm:px-[clamp(16px,4vw,48px)] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="nm-tabs" role="tablist" aria-label="사건 정보">
            {TABS.map((x) => (
              <button
                key={x.value}
                type="button"
                role="tab"
                id={`tab-${x.value}`}
                aria-selected={tab === x.value}
                aria-controls={`panel-${x.value}`}
                className="nm-tab"
                onClick={() => setTab(x.value)}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "prologue" && <Prologue theme={theme} detail={detail} />}
            {tab === "flow" && <Flow detail={detail} />}
            {tab === "cast" && <Cast detail={detail} />}
          </div>
        </div>

        <aside
          id="rooms"
          className="flex min-w-0 scroll-mt-20 flex-col gap-4 lg:sticky lg:top-[88px]"
        >
          <InviteCard />
          <RoomsCard play={play} />
        </aside>
      </main>
    </div>
  );
}

function DetailHeader({ signedIn }: { signedIn: boolean }) {
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
        "fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b pr-2 pl-[clamp(4px,3vw,40px)] transition-[background,border-color] duration-[220ms]",
        scrolled
          ? "border-border bg-[color-mix(in_oklch,var(--background)_92%,transparent)] backdrop-blur-[6px]"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Link href="/" className="nm-iconbtn text-foreground!" aria-label="로비로 돌아가기">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <Link href="/" className="flex flex-col leading-none text-foreground! no-underline!">
          <span className="font-display text-[19px] font-semibold tracking-[0.08em]">
            MURDER MYSTERY
          </span>
          <span className="mt-1 font-serif text-[10px] font-bold tracking-[0.35em] text-primary">
            머더 미스터리
          </span>
        </Link>
      </div>
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

function Prologue({ theme, detail }: { theme: Theme; detail: ThemeDetail }) {
  const pages = detail.prologue;
  const [page, setPage] = useState(0);
  const [readIdx, setReadIdx] = useState(-1);
  const [canSpeak, setCanSpeak] = useState(false);
  const token = useRef(0);
  const reading = readIdx >= 0;
  const pg = pages[page] ?? pages[0];
  const last = page === pages.length - 1;

  useEffect(() => {
    setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      token.current += 1;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const stopRead = () => {
    token.current += 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setReadIdx(-1);
  };

  const startRead = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const my = ++token.current;
    const voice = synth.getVoices().find((v) => /^ko/i.test(v.lang));
    const speak = (pi: number, i: number) => {
      if (token.current !== my) return;
      const p = pages[pi];
      if (!p) return setReadIdx(-1);
      if (i >= p.paras.length) return speak(pi + 1, 0);
      setPage(pi);
      setReadIdx(i);
      const u = new SpeechSynthesisUtterance((i === 0 ? `${p.title}. ` : "") + p.paras[i]);
      u.lang = "ko-KR";
      u.rate = 0.92;
      u.pitch = 0.95;
      if (voice) u.voice = voice;
      u.onend = () => speak(pi, i + 1);
      u.onerror = () => {
        if (token.current === my) setReadIdx(-1);
      };
      synth.speak(u);
    };
    speak(page, 0);
  };

  const go = (i: number) => {
    stopRead();
    setPage(i);
  };

  if (!pg) return null;
  const longest = Math.max(...pages.map((p) => p.paras.join("").length));

  return (
    <article className="flex flex-col gap-5 rounded-[6px] bg-[var(--paper-surface)] p-[clamp(22px,4vw,44px)] text-[var(--paper-ink)] shadow-[var(--shadow-paper)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--paper-ink-muted)]">
          <span>
            CASE FILE · {theme.caseNumber} — PROLOGUE {ROMAN[page] ?? page + 1}
          </span>
          {pg.subtitle && <span>{pg.subtitle}</span>}
        </div>
        <div className="day bg-transparent">
          <button
            type="button"
            className={cn("nm-btn nm-btn--sm", reading ? "nm-btn--secondary" : "nm-btn--outline")}
            disabled={!canSpeak}
            aria-pressed={reading}
            onClick={() => (reading ? stopRead() : startRead())}
          >
            {reading ? <Square size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
            {reading ? "읽기 멈춤" : "소리 내어 읽기"}
          </button>
        </div>
      </div>
      <h2 className="font-serif text-[clamp(22px,2.6vw,28px)] font-bold leading-[1.35] [text-wrap:balance]">
        {pg.title}
      </h2>
      <div
        className="flex max-w-[62ch] flex-col gap-1.5"
        style={{ minHeight: pages.length > 1 ? `${Math.ceil(longest / 38) * 1.9}em` : undefined }}
      >
        {pg.paras.map((text, i) => (
          <p
            // biome-ignore lint/suspicious/noArrayIndexKey: 문단 순서는 바뀌지 않는다
            key={i}
            className="-mx-2.5 rounded-[3px] px-2.5 py-1 font-serif text-[17px] leading-[1.9] transition-[background] duration-[220ms] [text-wrap:pretty]"
            style={{
              background:
                readIdx === i
                  ? "color-mix(in oklch, var(--brass-400) 22%, transparent)"
                  : undefined,
            }}
          >
            {text}
          </p>
        ))}
      </div>
      {last && detail.facts.length > 0 && (
        <dl className="mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-4 border-t-[3px] border-double border-[var(--paper-rule)] pt-[18px]">
          {detail.facts.map((f) => (
            <div key={f.k} className="flex flex-col gap-1.5">
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--paper-ink-muted)]">
                {f.k}
              </dt>
              <dd className="font-serif text-[15px] font-bold leading-[1.45]">{f.v}</dd>
            </div>
          ))}
        </dl>
      )}
      {pages.length > 1 && (
        <nav
          aria-label="프롤로그 페이지"
          className="day grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-[var(--paper-rule)] bg-transparent pt-4 text-[var(--paper-ink)]"
        >
          <div className="flex">
            <button
              type="button"
              className="nm-btn nm-btn--ghost nm-btn--sm"
              disabled={page === 0}
              onClick={() => go(page - 1)}
            >
              <ChevronLeft size={14} aria-hidden /> 이전 장
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            {pages.map((p, i) => (
              <button
                key={p.title}
                type="button"
                aria-label={`${i + 1}장: ${p.title}`}
                aria-current={i === page ? "page" : undefined}
                onClick={() => go(i)}
                className="flex cursor-pointer px-0.5 py-2"
              >
                <span
                  className="h-0.5 transition-[width,background] duration-[220ms]"
                  style={{
                    width: i === page ? 28 : 12,
                    background: i === page ? "var(--paper-ink)" : "var(--paper-rule)",
                  }}
                />
              </button>
            ))}
            <span className="whitespace-nowrap font-mono text-xs text-[var(--paper-ink-muted)]">
              {page + 1} / {pages.length}
            </span>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className={cn("nm-btn nm-btn--sm", last ? "nm-btn--outline" : "nm-btn--primary")}
              onClick={() => go(last ? 0 : page + 1)}
            >
              {last ? "처음으로" : "다음 장"}
              <ChevronRight size={14} aria-hidden />
            </button>
          </div>
        </nav>
      )}
    </article>
  );
}

function Flow({ detail }: { detail: ThemeDetail }) {
  const total = detail.phases.reduce((s, p) => s + p.minutes, 0);
  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-xl font-bold">진행 순서</h2>
          <span className="font-mono text-sm text-muted-foreground">총 {total}분</span>
        </div>
        <div aria-hidden className="flex h-1.5 gap-[3px]">
          {detail.phases.map((ph, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 고정된 목록
              key={i}
              className="rounded-full"
              style={{ flex: `${ph.minutes} 1 0`, background: PHASE_STYLE[ph.kind].color }}
            />
          ))}
        </div>
      </div>
      <ol className="flex flex-col overflow-hidden rounded-[6px] border border-border bg-card shadow-[var(--shadow-paper)]">
        {detail.phases.map((ph, i) => {
          const st = PHASE_STYLE[ph.kind];
          const Icon = st.icon;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 고정된 목록
              key={i}
              className={cn(
                "grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3.5 px-[18px] py-4",
                i > 0 && "border-t border-border",
              )}
            >
              <span
                className="flex size-9 items-center justify-center rounded-full border border-border-strong"
                style={{ color: st.color }}
              >
                <Icon size={18} aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-serif text-base font-bold leading-[1.4]">{ph.name}</span>
                <span className="text-sm text-muted-foreground [text-wrap:pretty]">
                  {ph.desc ?? st.desc}
                </span>
              </div>
              <span className="pt-0.5 font-mono text-sm text-muted-foreground">{ph.minutes}분</span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-xl font-bold">알아 둘 규칙</h2>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
          {RULES.map((r) => (
            <li
              key={r.t}
              className="flex items-start gap-3 rounded-[6px] border border-border bg-card p-4"
            >
              <span className="flex pt-0.5 text-primary">
                <r.icon size={18} aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[15px] font-bold leading-[1.4]">{r.t}</span>
                <span className="text-sm text-muted-foreground [text-wrap:pretty]">{r.d}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Cast({ detail }: { detail: ThemeDetail }) {
  if (detail.cast.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-[6px] border border-dashed border-border-strong px-4 py-10 text-center text-muted-foreground">
        <Hourglass size={22} aria-hidden />
        <span className="text-sm">등장인물은 시나리오가 준비되면 공개돼요.</span>
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-3.5">
      <p className="text-sm text-muted-foreground">
        각 인물의 비밀은 캐릭터를 고른 뒤에만 열람할 수 있어요.
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,190px),1fr))] gap-4">
        {detail.cast.map((p, i) => (
          <li
            key={p.name}
            className="flex flex-col overflow-hidden rounded-[6px] border border-border bg-card shadow-[var(--shadow-paper)] transition-[border-color,transform] duration-[140ms] hover:-translate-y-0.5 hover:border-border-strong"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-muted">
              {p.portrait ? (
                // biome-ignore lint/performance/noImgElement: 정적 SVG 초상
                <img
                  src={p.portrait}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover [filter:grayscale(.6)_sepia(.3)_brightness(.9)]"
                />
              ) : (
                <span
                  className="absolute inset-0 flex items-center justify-center font-display text-6xl font-semibold"
                  style={{ color: `var(--char-${p.colorIndex})` }}
                >
                  {p.name[0]}
                </span>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-[linear-gradient(180deg,transparent,color-mix(in_oklch,var(--card)_92%,transparent))]" />
              <span className="pointer-events-none absolute top-2.5 left-3 font-mono text-[11px] tracking-[0.04em]">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="relative -mt-[34px] flex flex-col gap-1.5 px-4 pt-1 pb-[18px]">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-primary">
                {p.role}
              </span>
              <span className="font-serif text-[19px] font-bold leading-[1.3]">{p.name}</span>
              <span className="mt-0.5 text-sm text-muted-foreground [text-wrap:pretty]">
                {p.line}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InviteCard() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return setError("초대 링크나 방 코드를 입력해 주세요.");
    const target = resolveInvite(value);
    if (!target) return setError("초대 링크 형식이 아니에요. 받은 링크를 그대로 붙여 넣어 주세요.");
    setError(null);
    router.push(target);
  };

  return (
    <section
      aria-label="초대 코드로 입장"
      className="flex flex-col gap-3 rounded-[6px] border border-border px-[18px] py-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-full border border-border-strong text-primary">
          <KeyRound size={18} aria-hidden />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-serif text-base font-bold leading-[1.35]">초대 코드로 입장</span>
          <span className="text-sm text-muted-foreground">
            받은 초대 링크나 방 코드로 들어갈 수 있어요.
          </span>
        </div>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
        <div className="nm-field min-w-0 flex-1">
          <input
            className="nm-input nm-input--mono"
            placeholder="초대 링크 또는 방 코드"
            aria-label="초대 링크 또는 방 코드"
            aria-invalid={!!error}
            aria-describedby={error ? "case-invite-error" : undefined}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
          {error && (
            <span id="case-invite-error" className="nm-field__hint nm-field__hint--error">
              {error}
            </span>
          )}
        </div>
        <button type="submit" className="nm-btn nm-btn--primary">
          입장
        </button>
      </form>
    </section>
  );
}

/** 대기실 목록. 게임 서버에 공개 방 목록 API가 생기기 전까지는 방 만들기만 제공한다 */
function RoomsCard({ play }: { play?: string }) {
  const create = play ? (
    <Link href={play} className="nm-btn nm-btn--secondary nm-btn--sm">
      <Plus size={14} aria-hidden /> 방 만들기
    </Link>
  ) : (
    <button type="button" disabled className="nm-btn nm-btn--secondary nm-btn--sm">
      <Hourglass size={14} aria-hidden /> 준비 중
    </button>
  );

  return (
    <section
      aria-label="대기실 목록"
      className="flex flex-col overflow-hidden rounded-[6px] border border-border bg-card shadow-[var(--shadow-paper)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-[18px] pt-4 pb-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            WAITING ROOMS
          </span>
          <h2 className="font-serif text-[19px] font-bold leading-[1.3]">
            대기실 <span className="font-mono text-[15px] text-muted-foreground">0</span>
          </h2>
        </div>
        {create}
      </div>
      <div className="flex flex-col items-center gap-3 px-[18px] py-8 text-center text-muted-foreground">
        <DoorClosed size={22} aria-hidden />
        <span className="text-sm">
          {play
            ? "지금 열린 대기실이 없어요. 직접 방을 열어 보세요."
            : "이 사건은 아직 준비 중이에요. 지금은 블랙우드 저택을 플레이할 수 있어요."}
        </span>
        {play && (
          <Link href={play} className="nm-btn nm-btn--outline nm-btn--sm">
            <Plus size={14} aria-hidden /> 방 만들기
          </Link>
        )}
      </div>
      {play && (
        <p className="border-t border-border px-[18px] py-3 text-sm text-muted-foreground">
          방을 만든 뒤 초대 링크를 함께할 사람들에게 보내 주세요.
        </p>
      )}
    </section>
  );
}
