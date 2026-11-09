"use client";

import {
  MAX_ROOM_TAGS,
  MAX_ROOM_TITLE,
  ROOM_NAME,
  ROOM_TAG_EXCLUSIVE,
  ROOM_TAGS,
  type RoomListing,
  type RoomTag,
  type RoomVisibility,
} from "@mm/game-protocol";
import { cn } from "@mm/ui";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Coffee,
  Copy,
  Crown,
  DoorClosed,
  DoorOpen,
  Drama,
  Eye,
  Fingerprint,
  Hourglass,
  KeyRound,
  LoaderCircle,
  Lock,
  type LucideIcon,
  MessageSquare,
  MessagesSquare,
  Mic,
  Plus,
  ScrollText,
  Search,
  ShieldCheck,
  Sprout,
  Square,
  Target,
  Users,
  Volume2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createGameClient, listRooms } from "@/lib/game-client";
import { dropHeldRoom, holdRoom } from "@/lib/room-handoff";
import { playPath, type Theme, type ThemeDetail, type ThemePhase } from "@/lib/theme";
import { resolveRoomCode } from "./invite";
import { Cover, ThemeBadges } from "./theme-meta";

type Tab = "prologue" | "flow" | "cast";

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

const TAG_META: Record<RoomTag, { label: string; icon: LucideIcon }> = {
  beginner: { label: "초보 환영", icon: Sprout },
  veteran: { label: "경험자", icon: Award },
  casual: { label: "가볍게", icon: Coffee },
  roleplay: { label: "롤플레이 중심", icon: Drama },
  voice: { label: "음성 채팅", icon: Mic },
  chat: { label: "채팅 전용", icon: MessageSquare },
};

const STATUS_META = {
  waiting: { label: "모집 중", tone: "nm-badge--alibi", icon: DoorOpen },
  full: { label: "가득 참", tone: "", icon: Users },
  playing: { label: "진행 중", tone: "nm-badge--discuss", icon: Hourglass },
} as const;

/** 내가 만든 방. 대기실 화면으로 넘어가기 전까지 이 화면이 연결을 쥐고 있다 */
type MyRoom = { code: string; title: string; visibility: RoomVisibility };

export function CaseDetail({
  theme,
  detail,
  signedIn,
  needsLogin,
}: {
  theme: Theme;
  detail: ThemeDetail;
  signedIn: boolean;
  /** 방을 만들거나 참가하려면 먼저 로그인해야 하는지 */
  needsLogin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("prologue");
  const [createOpen, setCreateOpen] = useState(false);
  const [mine, setMine] = useState<MyRoom | null>(null);
  // 대기실로 넘기지 않은 내 방. 렌더와 무관하게 유지해야 화면을 떠날 때 넘긴 방을 끊지 않는다
  const heldRef = useRef<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabsH, setTabsH] = useState(44);
  const rooms = useRooms(theme.scenarioVersionId);
  const play = playPath(theme);

  // 대기실에 들어가지 않고 이 화면을 떠나면 만들어 둔 방에서 나간다
  useEffect(
    () => () => {
      if (heldRef.current) dropHeldRoom(heldRef.current);
    },
    [],
  );

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTabsH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loginHref = `/login?next=${encodeURIComponent(`/cases/${theme.id}`)}`;
  const enterRoom = (code: string, scenarioVersionId: string) => {
    if (heldRef.current === code) heldRef.current = null;
    router.push(`/play/${scenarioVersionId}?room=${encodeURIComponent(code)}`);
  };
  const openCreate = () => (needsLogin ? router.push(loginHref) : setCreateOpen(true));

  const tabs: { value: Tab; label: string; icon: LucideIcon; count?: number }[] = [
    { value: "prologue", label: "프롤로그", icon: ScrollText },
    { value: "flow", label: "진행 방식", icon: Hourglass },
    ...(detail.cast.length > 0
      ? [{ value: "cast" as const, label: "등장인물", icon: Users, count: detail.cast.length }]
      : []),
  ];

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

      <main className="grid grid-cols-1 items-start gap-[clamp(28px,4vw,56px)] px-4 pt-2 pb-24 sm:px-[clamp(16px,4vw,48px)] lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div ref={tabsRef} className="nm-tabs" role="tablist" aria-label="사건 정보">
            {tabs.map((x) => (
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
                <x.icon size={16} aria-hidden />
                {x.label}
                {x.count !== undefined && <span className="nm-tab__count">{x.count}</span>}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "prologue" && (
              <Prologue theme={theme} detail={detail} onFinish={() => setTab("flow")} />
            )}
            {tab === "flow" && <Flow detail={detail} />}
            {tab === "cast" && <Cast detail={detail} />}
          </div>
        </div>

        <aside
          id="rooms"
          className="flex min-w-0 scroll-mt-20 flex-col gap-4 lg:sticky lg:top-[88px] lg:mt-[var(--aside-offset)]"
          style={{ "--aside-offset": `${tabsH + 24}px` } as CSSProperties}
        >
          <InviteCard needsLogin={needsLogin} loginHref={loginHref} />
          <RoomsCard
            playable={!!play}
            rooms={rooms}
            mine={mine}
            needsLogin={needsLogin}
            loginHref={loginHref}
            onCreate={openCreate}
            onEnter={enterRoom}
          />
        </aside>
      </main>

      {createOpen && theme.scenarioVersionId && (
        <CreateRoomDialog
          theme={theme}
          scenarioVersionId={theme.scenarioVersionId}
          mine={mine}
          onCreated={(r) => {
            heldRef.current = r.code;
            setMine(r);
            void rooms.refresh();
          }}
          onEnter={(code) => {
            setCreateOpen(false);
            enterRoom(code, theme.scenarioVersionId as string);
          }}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

/** 공개 대기실 목록. 5초마다 새로 받는다 */
function useRooms(scenarioVersionId?: string) {
  const [rooms, setRooms] = useState<RoomListing[] | null>(null);
  const [offline, setOffline] = useState(false);
  const refresh = useCallback(async () => {
    if (!scenarioVersionId) return;
    try {
      setRooms(await listRooms(scenarioVersionId));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [scenarioVersionId]);
  useEffect(() => {
    if (!scenarioVersionId) return;
    void refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [scenarioVersionId, refresh]);
  return { rooms: rooms ?? [], loaded: rooms !== null, offline, refresh };
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

function Prologue({
  theme,
  detail,
  onFinish,
}: {
  theme: Theme;
  detail: ThemeDetail;
  onFinish: () => void;
}) {
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
            className={cn("nm-btn nm-btn--sm", reading ? "nm-btn--primary" : "nm-btn--outline")}
            disabled={!canSpeak}
            aria-pressed={reading}
            onClick={() => (reading ? stopRead() : startRead())}
          >
            {reading ? <Square size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
            {reading ? "멈추기" : "읽어주기"}
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
              className={cn("nm-btn nm-btn--sm", last ? "nm-btn--primary" : "nm-btn--ghost")}
              onClick={() => {
                if (!last) return go(page + 1);
                stopRead();
                onFinish();
              }}
            >
              {last ? "진행 방식 보기" : "다음 장"}
              {last ? <ArrowRight size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
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
          <h2 className="font-serif text-xl font-bold">진행 방식</h2>
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

function Spinner({ size = 16 }: { size?: number }) {
  return <LoaderCircle size={size} className="animate-spin" aria-hidden />;
}

function InviteCard({ needsLogin, loginHref }: { needsLogin: boolean; loginHref: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (joining) return;
    setJoining(true);
    const result = await resolveRoomCode(code);
    if ("error" in result) {
      setJoining(false);
      return setError(result.error);
    }
    setError(null);
    router.push(needsLogin ? loginHref : result.path);
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
            비공개 방도 코드로 들어갈 수 있어요.
          </span>
        </div>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
        <div className="nm-field min-w-0 flex-1">
          <input
            className="nm-input nm-input--mono"
            placeholder="RAVEN-0427"
            maxLength={11}
            aria-label="초대 코드"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? "case-invite-error" : undefined}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
              setError(null);
            }}
          />
          {error && (
            <span id="case-invite-error" className="nm-field__hint nm-field__hint--error">
              {error}
            </span>
          )}
        </div>
        <button
          type="submit"
          className="nm-btn nm-btn--primary"
          aria-busy={joining}
          disabled={joining}
        >
          {joining && <Spinner />}
          입장
        </button>
      </form>
    </section>
  );
}

function RoomsCard({
  playable,
  rooms: { rooms, loaded, offline },
  mine,
  needsLogin,
  loginHref,
  onCreate,
  onEnter,
}: {
  playable: boolean;
  rooms: ReturnType<typeof useRooms>;
  mine: MyRoom | null;
  needsLogin: boolean;
  loginHref: string;
  onCreate: () => void;
  onEnter: (code: string, scenarioVersionId: string) => void;
}) {
  const router = useRouter();
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const isOpen = (r: RoomListing) => r.status === "waiting" && r.players < r.maxPlayers;
  // 내 방을 맨 위에 둔다
  const sorted = [...rooms].sort(
    (a, b) => Number(b.code === mine?.code) - Number(a.code === mine?.code),
  );
  const shown = onlyOpen ? sorted.filter((r) => isOpen(r) || r.code === mine?.code) : sorted;

  const createBtn = (variant: "secondary" | "outline") =>
    playable ? (
      <button type="button" className={`nm-btn nm-btn--${variant} nm-btn--sm`} onClick={onCreate}>
        <Plus size={14} aria-hidden /> 방 만들기
      </button>
    ) : (
      <button type="button" disabled className={`nm-btn nm-btn--${variant} nm-btn--sm`}>
        <Hourglass size={14} aria-hidden /> 준비 중
      </button>
    );

  let empty: ReactNode = null;
  if (!playable) empty = "이 사건은 아직 준비 중이에요. 지금은 블랙우드 저택을 플레이할 수 있어요.";
  else if (offline && rooms.length === 0)
    empty = "게임 서버에 연결하지 못했어요. 잠시 후 다시 불러올게요.";
  else if (!loaded) empty = null;
  else if (shown.length === 0)
    empty =
      rooms.length === 0
        ? "지금 열린 대기실이 없어요. 직접 방을 열어 보세요."
        : "지금 참가할 수 있는 방이 없어요. 직접 방을 열어 보세요.";

  return (
    <section
      aria-label="대기실 목록"
      className="flex flex-col overflow-hidden rounded-[6px] border border-border bg-card shadow-[var(--shadow-paper)]"
    >
      <div className="flex items-center justify-between gap-3 px-[18px] pt-4 pb-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            WAITING ROOMS
          </span>
          <h2 className="font-serif text-[19px] font-bold leading-[1.3]">
            대기실{" "}
            <span className="font-mono text-[15px] text-muted-foreground">{shown.length}</span>
          </h2>
        </div>
        {createBtn("secondary")}
      </div>
      <div className="border-b border-border px-[18px] pb-3">
        <label className="nm-switch">
          <input
            type="checkbox"
            role="switch"
            aria-checked={onlyOpen}
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
          />
          <span className="nm-switch__track" aria-hidden />
          참가 가능한 방만
        </label>
      </div>
      <ul
        className="flex flex-col overflow-y-auto [scrollbar-width:thin] lg:max-h-[calc(100vh-420px)]"
        aria-busy={playable && !loaded}
      >
        {shown.map((r, i) => {
          const own = r.code === mine?.code;
          const open = isOpen(r);
          const st =
            STATUS_META[r.status === "waiting" && r.players >= r.maxPlayers ? "full" : r.status];
          const label = own ? "입장" : open ? "참가" : r.status === "playing" ? "진행 중" : "마감";
          return (
            <li
              key={r.code}
              className={cn(
                "flex flex-col gap-2.5 px-[18px] py-3.5",
                i > 0 && "border-t border-border",
                own && "bg-[color-mix(in_oklch,var(--primary)_6%,transparent)]",
              )}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                    {own && (
                      <span className="nm-badge nm-badge--primary nm-badge--sm">
                        <Crown size={12} aria-hidden /> 내 방
                      </span>
                    )}
                  </div>
                  <span className="font-serif text-[15px] font-bold leading-[1.4] [text-wrap:pretty]">
                    {r.title}
                  </span>
                </div>
                <span className={cn("nm-badge nm-badge--sm flex-none", st.tone)}>
                  <st.icon size={12} aria-hidden /> {st.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span
                    role="img"
                    aria-label={`${r.maxPlayers}석 중 ${r.players}명 참가`}
                    className="flex items-center gap-[5px] whitespace-nowrap pr-1 font-mono text-xs text-muted-foreground"
                  >
                    <Users size={14} aria-hidden />
                    {r.players}/{r.maxPlayers}
                  </span>
                  {r.tags.map((t) => {
                    const m = TAG_META[t];
                    return (
                      <span key={t} className="nm-badge nm-badge--sm">
                        <m.icon size={12} aria-hidden /> {m.label}
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={cn(
                    "nm-btn nm-btn--sm flex-none",
                    open || own ? "nm-btn--primary" : "nm-btn--ghost",
                  )}
                  disabled={(!open && !own) || joining === r.code}
                  aria-busy={joining === r.code}
                  onClick={() => {
                    if (own) return onEnter(r.code, r.scenarioVersionId);
                    if (needsLogin) return router.push(loginHref);
                    setJoining(r.code);
                    onEnter(r.code, r.scenarioVersionId);
                  }}
                >
                  {joining === r.code && <Spinner size={14} />}
                  {label}
                </button>
              </div>
            </li>
          );
        })}
        {playable && !loaded && !offline && (
          <li className="flex justify-center px-[18px] py-8 text-muted-foreground">
            <Spinner size={20} />
            <span className="sr-only">대기실 목록을 불러오는 중</span>
          </li>
        )}
        {empty && (
          <li className="flex flex-col items-center gap-3 px-[18px] py-8 text-center text-muted-foreground">
            <DoorClosed size={22} aria-hidden />
            <span className="text-sm">{empty}</span>
            {playable && createBtn("outline")}
          </li>
        )}
      </ul>
      <p className="border-t border-border px-[18px] py-3 text-sm text-muted-foreground">
        비공개 방은 목록에 표시되지 않아요.
      </p>
    </section>
  );
}

function CreateRoomDialog({
  theme,
  scenarioVersionId,
  mine,
  onCreated,
  onEnter,
  onClose,
}: {
  theme: Theme;
  scenarioVersionId: string;
  mine: MyRoom | null;
  onCreated: (room: MyRoom) => void;
  onEnter: (code: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [titleErr, setTitleErr] = useState<string | null>(null);
  const [size, setSize] = useState(theme.maxPlayers);
  const [tags, setTags] = useState<RoomTag[]>([]);
  const [visibility, setVisibility] = useState<RoomVisibility>("public");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const done = !!mine;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, button:not(.nm-dialog__close)")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [onClose]);

  const toggleTag = (key: RoomTag) =>
    setTags((cur) => {
      if (cur.includes(key)) return cur.filter((x) => x !== key);
      const pair: RoomTag[] = ROOM_TAG_EXCLUSIVE.find((p) => p.includes(key)) ?? [];
      const next = cur.filter((x) => !pair.includes(x));
      return next.length >= MAX_ROOM_TAGS ? cur : [...next, key];
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (creating) return;
    const t = title.trim();
    if (!t) return setTitleErr("방 제목을 입력해 주세요.");
    setCreating(true);
    setError(null);
    try {
      const client = await createGameClient();
      const room = await client.create(ROOM_NAME, {
        scenarioVersionId,
        title: t,
        maxPlayers: size,
        tags,
        visibility,
      });
      holdRoom(room);
      onCreated({ code: room.roomId, title: t, visibility });
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("로그인")
          ? "로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요."
          : "방을 만들지 못했어요. 게임 서버 연결을 확인한 뒤 다시 시도해 주세요.",
      );
    } finally {
      setCreating(false);
    }
  };

  const copy = () => {
    if (!mine) return;
    navigator.clipboard?.writeText(mine.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const sizes: number[] = [];
  for (let n = theme.minPlayers; n <= theme.maxPlayers; n++) sizes.push(n);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 바깥을 누르면 닫는다 (키보드는 Esc)
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc로 닫기는 window에서 처리한다
    <div
      className="nm-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-room-title"
        aria-describedby="create-room-desc"
        className="nm-dialog"
        style={{ "--dialog-w": "480px" } as CSSProperties}
      >
        <div className="nm-dialog__header">
          <span className="nm-dialog__eyebrow">{done ? "ROOM OPENED" : "NEW ROOM"}</span>
          <h2 id="create-room-title" className="nm-dialog__title">
            {done ? "방이 열렸습니다" : "새 방을 엽니다"}
          </h2>
          <p id="create-room-desc" className="nm-dialog__desc">
            {!mine
              ? theme.title
              : mine.visibility === "public"
                ? "대기실 목록에 공개되었어요. 아래 코드로 친구를 초대하세요."
                : "비공개 방이에요. 아래 코드를 받은 사람만 들어올 수 있어요."}
          </p>
        </div>
        <button
          type="button"
          className="nm-iconbtn nm-dialog__close"
          aria-label="닫기"
          onClick={onClose}
        >
          <X size={20} aria-hidden />
        </button>
        <div className="nm-dialog__body">
          {mine ? (
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col items-center gap-2 rounded-[6px] bg-[var(--paper-surface)] px-4 py-[22px] text-[var(--paper-ink)]">
                <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--paper-ink-muted)]">
                  INVITE CODE
                </span>
                <span className="font-mono text-[clamp(26px,6vw,34px)] font-bold leading-[1.1] tracking-[0.08em]">
                  {mine.code}
                </span>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="nm-btn nm-btn--outline" onClick={copy}>
                  {copied ? <CircleCheck size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                  {copied ? "복사됨" : "코드 복사"}
                </button>
                <button
                  type="button"
                  className="nm-btn nm-btn--primary"
                  onClick={() => onEnter(mine.code)}
                >
                  <DoorOpen size={16} aria-hidden /> 대기실 입장
                </button>
              </div>
              <span className="sr-only" aria-live="polite">
                {copied ? "초대 코드를 복사했어요." : ""}
              </span>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-[18px]">
              <div className="nm-field">
                <label htmlFor="room-title" className="nm-field__label">
                  방 제목
                </label>
                <input
                  id="room-title"
                  className="nm-input"
                  placeholder="예: 초보 환영, 천천히 진행해요"
                  maxLength={MAX_ROOM_TITLE}
                  value={title}
                  aria-invalid={!!titleErr}
                  aria-describedby={titleErr ? "room-title-error" : undefined}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleErr(null);
                  }}
                />
                {titleErr && (
                  <span id="room-title-error" className="nm-field__hint nm-field__hint--error">
                    {titleErr}
                  </span>
                )}
              </div>
              {theme.minPlayers !== theme.maxPlayers && (
                <div className="nm-field">
                  <label htmlFor="room-size" className="nm-field__label">
                    인원
                  </label>
                  <div className="nm-select-wrap">
                    <select
                      id="room-size"
                      className="nm-input nm-select"
                      value={size}
                      aria-describedby="room-size-hint"
                      onChange={(e) => setSize(Number(e.target.value))}
                    >
                      {sizes.map((n) => (
                        <option key={n} value={n}>
                          {n}인
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="nm-icon" aria-hidden />
                  </div>
                  <span id="room-size-hint" className="nm-field__hint">
                    인원이 모두 모이면 캐릭터 선택이 시작돼요.
                  </span>
                </div>
              )}
              <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
                <legend className="mb-2.5 p-0 text-[13px] font-semibold">
                  방 성격{" "}
                  <span className="font-normal text-muted-foreground">
                    · 최대 {MAX_ROOM_TAGS}개
                  </span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {ROOM_TAGS.map((key) => {
                    const m = TAG_META[key];
                    const on = tags.includes(key);
                    const off = !on && tags.length >= MAX_ROOM_TAGS;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={on}
                        disabled={off}
                        onClick={() => toggleTag(key)}
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-[background,border-color] duration-[140ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                          on
                            ? "border-primary bg-[color-mix(in_oklch,var(--primary)_18%,transparent)]"
                            : "border-border-strong bg-transparent",
                          off ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
                        )}
                      >
                        <m.icon size={14} aria-hidden />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-sm text-muted-foreground">
                  초보 환영·경험자, 음성 채팅·채팅 전용은 하나만 고를 수 있어요.
                </span>
              </fieldset>
              <fieldset className="nm-radiogroup">
                <legend>공개 범위</legend>
                {(
                  [
                    ["public", "공개", "대기실 목록에 표시되어 누구나 참가할 수 있어요."],
                    ["private", "비공개", "초대 코드를 받은 사람만 들어올 수 있어요."],
                  ] as const
                ).map(([value, label, desc]) => (
                  <label key={value} className="nm-check">
                    <input
                      type="radio"
                      name="visibility"
                      className="nm-check__box nm-check__box--radio"
                      checked={visibility === value}
                      onChange={() => setVisibility(value)}
                    />
                    <span className="nm-check__text">
                      {label}
                      <span className="nm-check__desc">{desc}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {error && (
                <p role="alert" className="text-sm text-[var(--destructive-text)]">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="nm-btn nm-btn--ghost" onClick={onClose}>
                  취소
                </button>
                <button
                  type="submit"
                  className="nm-btn nm-btn--primary"
                  aria-busy={creating}
                  disabled={creating}
                >
                  {creating && <Spinner />}방 만들기
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
