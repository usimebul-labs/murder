"use client";

import { cn } from "@mm/ui";
import {
  Check,
  Eye,
  Fingerprint,
  Gift,
  Hourglass,
  LayoutGrid,
  MapPin,
  MessagesSquare,
  Mic,
  MicOff,
  Users,
} from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { josa } from "@/lib/josa";
import { ChatPanel } from "../chat";
import { DiscussionBoard } from "../clue-board";
import {
  ActionBar,
  Avatar,
  btn,
  ClueCard,
  Countdown,
  Eyebrow,
  formatClock,
  Overlay,
  phaseTone,
  TopBar,
  useNow,
} from "../primitives";
import { ClueDetail, FloorPlan, HeaderTools, MapToggle } from "../tools";
import type { ClueCardInfo, GameContext } from "../types";

const pad = (n: number) => String(n).padStart(2, "0");

/** 모바일에서는 아래 탭으로 패널을 바꾸고, 넓은 화면에서는 모두 보인다 */
function useMobileTabs<T extends string>(initial: T) {
  const [tab, setTab] = useState<T>(initial);
  const panel = (id: T) => (tab === id ? "flex" : "hidden lg:flex");
  return { tab, setTab, panel };
}

function MobileTabBar<T extends string>({
  tabs,
  tab,
  setTab,
}: {
  tabs: { id: T; label: string; icon: ReactNode; count?: number }[];
  tab: T;
  setTab: (t: T) => void;
}) {
  return (
    <nav
      className="sticky bottom-0 z-20 flex h-[60px] flex-none border-t border-border bg-background lg:hidden"
      aria-label="화면 전환"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          aria-current={tab === t.id}
          className={cn(
            "relative flex flex-1 items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground",
            tab === t.id &&
              "text-foreground after:absolute after:inset-x-4 after:top-0 after:h-0.5 after:bg-primary",
          )}
        >
          {t.icon}
          {t.label}
          {!!t.count && (
            <span className="rounded-full bg-muted px-1.5 font-mono text-[11px]">{t.count}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

/** 내가 볼 수 있는 단서 내용 */
function useClues(ctx: GameContext) {
  return useMemo(() => {
    const cards = Object.values(ctx.state.cards);
    const clues = ctx.state.clues ?? {};
    const mine = cards.filter((c) => c.holderId === ctx.myCharacterId && ctx.myCharacterId);
    const publicCards = cards.filter((c) => c.isPublic);
    return { cards, clues, mine, publicCards };
  }, [ctx.state.cards, ctx.state.clues, ctx.myCharacterId]);
}

function HolderTag({
  ctx,
  card,
  blocked,
}: {
  ctx: GameContext;
  card: ClueCardInfo;
  /** 보드 위에 있지만 내가 고를 수 없는 이유 */
  blocked?: string;
}) {
  if (!card.holderId) {
    return card.isPublic ? (
      <span className="inline-flex items-center gap-1 font-semibold">
        <Eye size={12} /> 공통 자료
      </span>
    ) : (
      <span className="text-[var(--paper-ink-muted)]">{blocked ?? "미수집"}</span>
    );
  }
  const c = ctx.character(card.holderId);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar character={c} size={18} />
      <span className="truncate">
        {card.holderId === ctx.myCharacterId ? "내 단서" : c?.name}
        {card.isPublic && " · 공개"}
      </span>
    </span>
  );
}

/* ───────────── 탐색 ───────────── */

export function Explore({ ctx }: { ctx: GameContext }) {
  const { state, phase, scenario, myCharacterId } = ctx;
  const { cards, clues, mine } = useClues(ctx);
  const [mode, setMode] = useState<"place" | "person">("place");
  const [location, setLocation] = useState("all");
  const [person, setPerson] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClueCardInfo | null>(null);
  const [showMap, setShowMap] = useState(true);
  const { tab, setTab, panel } = useMobileTabs<"board" | "hand" | "chat">("board");
  const round = phase?.round ?? 1;
  const myTurn = !!myCharacterId && state.turnCharacterId === myCharacterId;
  const turnCharacter = ctx.character(state.turnCharacterId);
  const tone = phaseTone("investigation");

  // 탐색 단서는 단계별로 나누지 않고 모두 보드에 나온다. 장소 단서와 인물 단서는 따로 있다
  const searchCards = cards.filter((c) => c.distribution === "search");
  const placeCards = searchCards.filter((c) => c.locationId);
  const personCards = searchCards.filter((c) => c.characterId);
  const counts: Record<string, number> = {};
  const personCounts: Record<string, number> = {};
  for (const c of searchCards) {
    if (c.holderId) continue;
    if (c.locationId) counts[c.locationId] = (counts[c.locationId] ?? 0) + 1;
    if (c.characterId) personCounts[c.characterId] = (personCounts[c.characterId] ?? 0) + 1;
  }
  const people = state.characters.filter((c) => personCards.some((x) => x.characterId === c.id));
  const picked = new Set(ctx.me?.pickedTargets ?? []);
  const targetOf = (c: ClueCardInfo) =>
    c.locationId ? `place:${c.locationId}` : `person:${c.characterId}`;
  /** 보드 위 카드를 내가 고를 수 없는 이유 (고를 수 있으면 undefined) */
  const blockedReason = (c: ClueCardInfo) => {
    if (!myCharacterId || c.holderId || c.isPublic) return undefined;
    if (c.characterId === myCharacterId) return "내 인물 단서";
    if (picked.has(targetOf(c))) return "이번 탐색에 조사함";
    return undefined;
  };
  const visible = (mode === "place" ? placeCards : personCards)
    .filter((c) =>
      mode === "place"
        ? location === "all" || c.locationId === location
        : person === "all" || c.characterId === person,
    )
    .sort((a, b) => Number(!!a.holderId) - Number(!!b.holderId) || a.code.localeCompare(b.code));
  const remaining = searchCards.filter((c) => !c.holderId).length;
  const placeRemaining = placeCards.filter((c) => !c.holderId).length;
  const personRemaining = personCards.filter((c) => !c.holderId).length;
  const seats = [...new Set(state.turnOrder)];
  const perPlayer = seats.length ? Math.round(state.turnTotal / seats.length) : 0;
  const filterTab = (active: boolean) =>
    cn(
      "inline-flex h-9 flex-none items-center gap-1.5 rounded-[3px] px-3 text-sm font-semibold text-muted-foreground",
      active && "bg-accent text-foreground",
    );
  const lap = seats.length ? Math.floor(Math.max(0, state.turnNumber - 1) / seats.length) + 1 : 1;

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        eyebrow={phase?.titleCard || `ROUND ${pad(round)} · EXPLORE`}
        title={`${phase?.title ?? "탐색"} · ${state.scenarioTitle}`}
        tone={tone}
        right={
          <>
            <Countdown endsAt={state.phaseEndsAt} tone={tone} label="탐색" />
            <HeaderTools ctx={ctx} />
          </>
        }
      />
      <section
        className="flex-none border-b border-border bg-card px-4 py-3 sm:px-6"
        aria-label="수집 차례"
      >
        <div className="flex items-center gap-4">
          {state.turnCharacterId ? (
            <Countdown
              endsAt={state.turnEndsAt}
              tone={myTurn ? "var(--primary)" : "var(--muted-foreground)"}
              className={myTurn ? "shadow-[var(--glow-candle)]" : undefined}
            />
          ) : (
            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 font-mono text-sm text-muted-foreground">
              <Hourglass size={14} /> 수집 끝
            </span>
          )}
          <div className="min-w-0">
            <Eyebrow>
              TURN {pad(Math.min(state.turnNumber, state.turnTotal))} / {pad(state.turnTotal)} ·{" "}
              {lap}바퀴째
            </Eyebrow>
            <p className="truncate font-serif text-lg font-bold">
              {!state.turnCharacterId
                ? "이번 라운드의 수집이 끝났습니다"
                : myTurn
                  ? "당신의 차례입니다"
                  : `${turnCharacter?.name}의 차례입니다`}
            </p>
          </div>
        </div>
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {seats.map((id, i) => {
            const c = ctx.character(id);
            const p = ctx.playerOf(id);
            const current = state.turnCharacterId === id;
            const held = cards.filter((x) => x.holderId === id).length;
            return (
              <li
                key={id}
                className={cn(
                  "flex min-w-44 flex-1 items-center gap-2.5 rounded-[6px] border px-3 py-2",
                  current
                    ? "border-primary bg-[var(--clue-surface)] shadow-[var(--glow-candle)]"
                    : "border-border bg-background",
                  p && !p.connected && "opacity-50",
                )}
              >
                <span className="font-mono text-[11px] text-muted-foreground">{pad(i + 1)}</span>
                <Avatar character={c} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {c?.name.split(" ")[0]}
                    {id === myCharacterId && " (나)"}
                  </p>
                  <p
                    className={cn(
                      "text-[11px]",
                      current ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {current ? "차례" : p?.picksLeft ? `남은 수집 ${p.picksLeft}` : "완료"}
                  </p>
                </div>
                <span className="font-display text-xl" title="가진 단서">
                  {held}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <main className={cn("min-h-0 flex-1 flex-col overflow-y-auto", panel("board"))}>
          <div className="space-y-4 px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Eyebrow>
                  EVIDENCE BOARD · 남은 카드 {remaining}/{searchCards.length}
                </Eyebrow>
                <h2 className="mt-1 font-serif text-2xl font-bold">단서 보드</h2>
                {perPlayer > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    이번 탐색에서는 한 사람당 {perPlayer}장까지 수집할 수 있어요. 같은 장소나 같은
                    인물의 단서는 한 장만 가져갈 수 있고, 내 인물에 대한 단서는 가져갈 수 없어요.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="flex gap-1 rounded-md border border-border bg-[var(--input-bg)] p-[3px]"
                  role="tablist"
                  aria-label="탐색 방식"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "place"}
                    onClick={() => setMode("place")}
                    className={filterTab(mode === "place")}
                  >
                    <MapPin size={14} aria-hidden /> 장소 단서
                    <span className="rounded-full bg-muted px-1.5 font-mono text-[11px]">
                      {placeRemaining}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "person"}
                    onClick={() => setMode("person")}
                    className={filterTab(mode === "person")}
                  >
                    <Users size={14} aria-hidden /> 인물 단서
                    <span className="rounded-full bg-muted px-1.5 font-mono text-[11px]">
                      {personRemaining}
                    </span>
                  </button>
                </div>
                {mode === "place" && (
                  <MapToggle show={showMap} onToggle={() => setShowMap((v) => !v)} />
                )}
              </div>
            </div>
            {mode === "place" ? (
              <>
                {showMap && (
                  <FloorPlan ctx={ctx} selected={location} onSelect={setLocation} counts={counts} />
                )}
                <div
                  className="flex gap-1 overflow-x-auto rounded-md border border-border bg-[var(--input-bg)] p-[3px]"
                  role="tablist"
                  aria-label="장소"
                >
                  {[{ id: "all", name: "전체" }, ...(scenario?.locations ?? [])].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="tab"
                      aria-selected={location === l.id}
                      onClick={() => setLocation(l.id)}
                      className={filterTab(location === l.id)}
                    >
                      {l.name}
                      {picked.has(`place:${l.id}`) && (
                        <Check size={12} aria-label="이번 탐색에 조사함" className="text-primary" />
                      )}
                      <span className="rounded-full bg-muted px-1.5 font-mono text-[11px]">
                        {l.id === "all" ? placeRemaining : (counts[l.id] ?? 0)}
                      </span>
                    </button>
                  ))}
                </div>
                {location !== "all" && (
                  <p className="text-sm text-muted-foreground">
                    {scenario?.locations.find((l) => l.id === location)?.description}
                  </p>
                )}
              </>
            ) : (
              <>
                <ul
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4"
                  aria-label="인물"
                >
                  {[undefined, ...people].map((c) => {
                    const id = c?.id ?? "all";
                    const active = person === id;
                    const note = !c
                      ? "모든 인물"
                      : c.id === myCharacterId
                        ? "내 인물 · 수집 불가"
                        : picked.has(`person:${c.id}`)
                          ? `${c.role} · 이번 탐색에 조사함`
                          : c.role;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setPerson(active && c ? "all" : id)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-[6px] border px-3 py-2 text-left transition-colors hover:bg-accent",
                            active
                              ? "border-primary bg-[var(--clue-surface)]"
                              : "border-border bg-background",
                          )}
                        >
                          {c ? (
                            <Avatar character={c} size={30} />
                          ) : (
                            <span className="grid size-[30px] flex-none place-items-center rounded-full bg-muted">
                              <LayoutGrid size={14} aria-hidden />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {c ? c.name : "전체"}
                              {c?.id === myCharacterId && " (나)"}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {note}
                            </span>
                          </span>
                          <span className="rounded-full bg-muted px-1.5 font-mono text-[11px]">
                            {c ? (personCounts[c.id] ?? 0) : personRemaining}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {person !== "all" && (
                  <p className="text-sm text-muted-foreground">
                    {ctx.character(person)?.name}에 대한 단서예요.
                    {person === myCharacterId && " 내 인물의 단서라서 가져갈 수 없어요."}
                  </p>
                )}
              </>
            )}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((card) => {
                const clue = clues[card.id];
                const blocked = blockedReason(card);
                const free = !card.holderId && !blocked;
                return (
                  <li key={card.id}>
                    <ClueCard
                      card={card}
                      clue={clue}
                      compact
                      selected={selected === card.id}
                      className={cn(
                        "min-h-40 w-full",
                        !card.holderId && blocked && "opacity-50",
                        card.holderId && !clue && "opacity-60",
                      )}
                      onClick={() => {
                        if (free && myTurn) setSelected(card.id);
                        else setDetail(card);
                      }}
                      holder={<HolderTag ctx={ctx} card={card} blocked={blocked} />}
                    />
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="col-span-full py-10 text-center text-sm text-muted-foreground">
                  {mode === "person"
                    ? "이 인물과 관련된 단서가 없어요"
                    : "이 장소에는 단서가 없어요"}
                </li>
              )}
            </ul>
          </div>
        </main>

        <aside
          className={cn(
            "min-h-0 flex-1 flex-col border-l border-border bg-[var(--ink-950)]",
            panel("hand"),
            "lg:hidden",
          )}
        >
          <Hand ctx={ctx} onOpen={setDetail} />
        </aside>
        <aside
          className={cn(
            "min-h-0 flex-1 flex-col border-l border-border",
            panel("chat"),
            "lg:hidden",
          )}
        >
          <ChatPanel ctx={ctx} />
        </aside>
        <aside className="hidden min-h-0 flex-col border-l border-border bg-[var(--ink-950)] lg:flex">
          <div className="min-h-0 flex-[3] overflow-y-auto">
            <Hand ctx={ctx} onOpen={setDetail} />
          </div>
          <div className="flex min-h-0 flex-[2] flex-col border-t border-border">
            <ChatPanel ctx={ctx} />
          </div>
        </aside>
      </div>

      {myTurn ? (
        <ActionBar
          eyebrow="YOUR TURN"
          title="단서 하나를 고르십시오"
          desc="뒤집힌 카드를 눌러 선택하세요. 시간이 지나면 고를 수 있는 단서 중 하나가 무작위로 수집돼요."
          tone="var(--primary)"
        >
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (selected) ctx.send("clue:pick", { clueId: selected });
              setSelected(null);
            }}
            className={cn(btn.base, btn.primary)}
          >
            <Fingerprint size={16} /> 단서 수집
          </button>
        </ActionBar>
      ) : (
        <ActionBar
          eyebrow={state.turnCharacterId ? "WAITING" : "ROUND COMPLETE"}
          title={
            state.turnCharacterId
              ? `${josa(turnCharacter?.name ?? "", "이/가")} 단서를 고르는 중입니다`
              : "곧 토론이 시작됩니다"
          }
          desc={`내 단서 ${mine.length}장 · 차례가 오면 알려 드려요`}
        >
          {ctx.me?.isHost && <HostAdvance ctx={ctx} />}
        </ActionBar>
      )}
      <MobileTabBar
        tab={tab}
        setTab={setTab}
        tabs={[
          { id: "board", label: "보드", icon: <LayoutGrid size={16} /> },
          { id: "hand", label: "내 단서", icon: <Fingerprint size={16} />, count: mine.length },
          { id: "chat", label: "대화", icon: <MessagesSquare size={16} /> },
        ]}
      />
      <ClueDetail
        ctx={ctx}
        card={detail ?? undefined}
        clue={detail ? clues[detail.id] : undefined}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function Hand({ ctx, onOpen }: { ctx: GameContext; onOpen: (c: ClueCardInfo) => void }) {
  const { mine, clues, publicCards } = useClues(ctx);
  const commons = publicCards.filter((c) => !c.holderId);
  return (
    <div className="space-y-4 p-4">
      <div>
        <Eyebrow tone="var(--primary)">IN YOUR HAND · {mine.length}장</Eyebrow>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          단서 내용은 당신만 볼 수 있어요. 다른 참가자에게는 분류와 출처만 보여요.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {mine.map((card) => (
          <li key={card.id}>
            <ClueCard
              card={card}
              clue={clues[card.id]}
              compact
              className="min-h-32 w-full"
              onClick={() => onOpen(card)}
              footer={card.isPublic ? <span className="font-semibold">공개됨</span> : undefined}
            />
          </li>
        ))}
        {mine.length === 0 && (
          <li className="col-span-2 rounded-[6px] border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            아직 가진 단서가 없습니다
          </li>
        )}
      </ul>
      {commons.length > 0 && (
        <>
          <Eyebrow>공통 자료</Eyebrow>
          <ul className="grid grid-cols-2 gap-2">
            {commons.map((card) => (
              <li key={card.id}>
                <ClueCard
                  card={card}
                  clue={clues[card.id]}
                  compact
                  className="min-h-32 w-full"
                  onClick={() => onOpen(card)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function HostAdvance({ ctx, label = "다음 단계로" }: { ctx: GameContext; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("방장 권한으로 지금 다음 단계로 넘어갈까요?"))
          ctx.send("phase:advance", {});
      }}
      className={cn(btn.base, btn.outline, btn.sm)}
    >
      {label}
    </button>
  );
}

/* ───────────── 토론 ───────────── */

export function Discussion({ ctx }: { ctx: GameContext }) {
  const { state, phase, myCharacterId } = ctx;
  const { cards, clues, mine, publicCards } = useClues(ctx);
  const visible = useMemo(
    () => [...publicCards, ...mine.filter((c) => !c.isPublic)],
    [publicCards, mine],
  );
  const boardRef = useRef<HTMLElement>(null);
  const [detail, setDetail] = useState<ClueCardInfo | null>(null);
  const [giving, setGiving] = useState<ClueCardInfo | null>(null);
  const { tab, setTab, panel } = useMobileTabs<"board" | "chat">("board");
  const round = phase?.round ?? 1;
  const tone = phaseTone("discussion");
  const seated = state.characters.filter((c) => ctx.playerOf(c.id));
  const allowGive = !!myCharacterId;

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        eyebrow={phase?.titleCard || `ROUND ${pad(round)} · DISCUSSION`}
        title={`${phase?.title ?? "토론"}${phase?.allowWhisper ? " · 밀담 가능" : ""}`}
        tone={tone}
        right={
          <>
            <Countdown endsAt={state.phaseEndsAt} tone={tone} label="토론" />
            <HeaderTools ctx={ctx} />
          </>
        }
      />
      <section
        className="flex flex-none gap-2 overflow-x-auto border-b border-border bg-card px-4 py-3 sm:px-6"
        aria-label="참가자"
      >
        {seated.map((c) => {
          const p = ctx.playerOf(c.id);
          return (
            <div
              key={c.id}
              className={cn(
                "flex min-w-44 flex-1 items-center gap-2.5 rounded-[6px] border px-3 py-2",
                c.id === myCharacterId ? "border-[var(--brass-700)]" : "border-border",
                p && !p.connected && "opacity-50",
              )}
            >
              <Avatar character={c} size={34} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {c.name}
                  {c.id === myCharacterId && " (나)"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {c.role} · 단서 {cards.filter((x) => x.holderId === c.id).length}장
                  {p?.whispering && <span className="text-[var(--secret)]"> · 밀담 중</span>}
                </p>
              </div>
            </div>
          );
        })}
      </section>
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <main
          ref={boardRef}
          className={cn("min-h-0 flex-1 flex-col overflow-y-auto", panel("board"))}
        >
          <DiscussionBoard
            ctx={ctx}
            cards={visible}
            clues={clues}
            scrollRef={boardRef}
            onOpen={setDetail}
          />
        </main>
        <section className={cn("min-h-0 flex-1 flex-col border-l border-border", panel("chat"))}>
          <div className="flex h-12 flex-none items-center justify-between border-b border-border px-4">
            <p className="font-serif font-bold">
              <span className="mr-2 font-mono text-[11px] font-bold tracking-[0.14em] text-muted-foreground">
                CHAT
              </span>
              토론 기록
            </p>
            {phase?.allowWhisper && (
              <span className="text-xs text-[var(--secret)]">
                밀담 가능 · 최대 {phase.whisperMax || 3}인
              </span>
            )}
          </div>
          <ChatPanel
            ctx={ctx}
            className="flex-1"
            placeholder="음성이 어려울 때 채팅으로 남기세요"
          />
        </section>
      </div>
      <ActionBar
        eyebrow="DISCUSSION"
        title="단서를 공개하거나 건네며 진실을 좁히십시오"
        desc="공개한 단서는 모두가 볼 수 있어요. 건넨 단서는 되돌릴 수 없어요."
        tone={tone}
      >
        {ctx.me?.isHost && <HostAdvance ctx={ctx} />}
      </ActionBar>
      <MobileTabBar
        tab={tab}
        setTab={setTab}
        tabs={[
          { id: "board", label: "단서판", icon: <LayoutGrid size={16} /> },
          { id: "chat", label: "토론", icon: <MessagesSquare size={16} /> },
        ]}
      />
      <ClueDetail
        ctx={ctx}
        card={detail ?? undefined}
        clue={detail ? clues[detail.id] : undefined}
        onClose={() => setDetail(null)}
        actions={
          detail && detail.holderId === myCharacterId ? (
            <>
              {allowGive && (
                <button
                  type="button"
                  onClick={() => {
                    setGiving(detail);
                    setDetail(null);
                  }}
                  className={cn(btn.base, btn.secondary)}
                >
                  <Gift size={16} /> 건네기
                </button>
              )}
              {!detail.isPublic && (
                <button
                  type="button"
                  onClick={() => {
                    ctx.send("clue:share", { clueId: detail.id });
                    setDetail(null);
                  }}
                  className={cn(btn.base, btn.primary)}
                >
                  <Eye size={16} /> 모두에게 공개
                </button>
              )}
            </>
          ) : undefined
        }
      />
      <GiveDialog ctx={ctx} card={giving} onClose={() => setGiving(null)} />
    </div>
  );
}

function GiveDialog({
  ctx,
  card,
  onClose,
}: {
  ctx: GameContext;
  card: ClueCardInfo | null;
  onClose: () => void;
}) {
  const clue = card ? ctx.state.clues?.[card.id] : undefined;
  const others = ctx.state.characters.filter(
    (c) => c.id !== ctx.myCharacterId && ctx.playerOf(c.id),
  );
  if (!card) return null;
  return (
    <Overlay>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="단서 건네기"
        className="w-full max-w-md rounded-[6px] border border-border-strong bg-popover p-5 shadow-[var(--shadow-modal)]"
      >
        <Eyebrow>HAND OVER · {card.code}</Eyebrow>
        <h2 className="mt-1 font-serif text-2xl font-bold">누구에게 건넵니까</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {clue?.title} — 건넨 단서는 되돌릴 수 없습니다.
        </p>
        <ul className="mt-4 grid gap-2">
          {others.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`${c.name}에게 ${josa(card.code, "을/를")} 건넬까요?`)) {
                    ctx.send("clue:give", { clueId: card.id, toCharacterId: c.id });
                    onClose();
                  }
                }}
                className="flex w-full items-center gap-3 rounded-[6px] border border-border bg-card px-3 py-2 text-left hover:border-border-strong hover:bg-accent"
              >
                <Avatar character={c} size={36} />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.role}</span>
                </span>
                <Gift size={16} className="text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} className={cn(btn.base, btn.ghost, "mt-4 w-full")}>
          취소
        </button>
      </div>
    </Overlay>
  );
}

/* ───────────── 최후 진술 ───────────── */

export function Statements({ ctx }: { ctx: GameContext }) {
  const { state, phase, myCharacterId } = ctx;
  const { clues, publicCards } = useClues(ctx);
  const [detail, setDetail] = useState<ClueCardInfo | null>(null);
  const { tab, setTab, panel } = useMobileTabs<"stage" | "chat">("stage");
  const now = useNow();
  const tone = phaseTone("final-statements");
  const speaker = ctx.character(state.speakerCharacterId);
  const order = state.speakerOrder;
  const index = order.indexOf(state.speakerCharacterId);
  const speaking = !!myCharacterId && state.speakerCharacterId === myCharacterId;
  const myIndex = order.indexOf(myCharacterId);
  const perSec = state.speakerSec || 120;
  const left = Math.max(0, state.speakerEndsAt - now);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        eyebrow={phase?.titleCard || "FINAL STATEMENTS"}
        title={`${phase?.title ?? "최후 진술"} · ${state.scenarioTitle}`}
        tone={tone}
        right={
          <>
            <Countdown endsAt={state.phaseEndsAt} tone={tone} />
            <HeaderTools ctx={ctx} />
          </>
        }
      />
      <ol className="flex flex-none gap-2 overflow-x-auto border-b border-border bg-card px-4 py-3 sm:px-6">
        {order.map((id, i) => {
          const c = ctx.character(id);
          const status =
            i < index || (index < 0 && !state.speakerCharacterId)
              ? "완료"
              : i === index
                ? "발언 중"
                : "대기";
          return (
            <li
              key={id}
              className={cn(
                "flex min-w-40 flex-1 items-center gap-2.5 rounded-[6px] border px-3 py-2",
                status === "발언 중"
                  ? "border-[var(--phase-discuss)] bg-[var(--phase-discuss-surface)]"
                  : "border-border",
              )}
            >
              <span className="font-mono text-[11px] text-muted-foreground">{pad(i + 1)}</span>
              <Avatar character={c} size={30} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {c?.name}
                  {id === myCharacterId && " (나)"}
                </p>
                <p
                  className="text-[11px]"
                  style={{ color: status === "발언 중" ? tone : "var(--muted-foreground)" }}
                >
                  {status === "발언 중" ? `발언 ${formatClock(left)}` : status}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_400px]">
        <main className={cn("min-h-0 flex-1 flex-col overflow-y-auto", panel("stage"))}>
          <div className="space-y-6 px-4 py-6 sm:px-8">
            {speaker ? (
              <div className="flex flex-wrap items-center gap-6">
                <Avatar
                  character={speaker}
                  size={112}
                  ring={tone}
                  className="shadow-[0_0_0_6px_color-mix(in_oklch,var(--phase-discuss)_18%,transparent)]"
                />
                <div className="min-w-0 flex-1">
                  <Eyebrow tone={tone}>
                    NOW SPEAKING · {pad(index + 1)} / {pad(order.length)}
                  </Eyebrow>
                  <h2 className="mt-1 font-display text-4xl font-semibold md:text-5xl">
                    {speaker.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{speaker.role}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {speaking ? <Mic size={13} /> : <MicOff size={13} />}
                    {speaking
                      ? "당신의 차례입니다. 남은 시간 안에 의견을 정리해 말하십시오."
                      : "발언자 외에는 듣고 메모하는 시간입니다."}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-5xl tabular-nums md:text-6xl">
                    {formatClock(left)}
                  </p>
                  <div className="mt-2 h-1 w-48 overflow-hidden rounded-full bg-[var(--ink-600)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, (left / 1000 / perSec) * 100)}%`,
                        background: tone,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <Eyebrow tone={tone}>ALL STATEMENTS DONE</Eyebrow>
                <p className="mt-2 font-serif text-2xl font-bold">
                  모든 진술이 끝났습니다. 곧 투표가 시작됩니다
                </p>
              </div>
            )}
            <hr className="border-border" />
            <section>
              <Eyebrow>EVIDENCE TABLE</Eyebrow>
              <h3 className="mt-1 font-serif text-xl font-bold">
                공개 단서 · {publicCards.length}장
              </h3>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {publicCards.map((card) => (
                  <li key={card.id}>
                    <ClueCard
                      card={card}
                      clue={clues[card.id]}
                      compact
                      className="min-h-32 w-full"
                      onClick={() => setDetail(card)}
                      holder={<HolderTag ctx={ctx} card={card} />}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
        <aside className={cn("min-h-0 flex-1 flex-col border-l border-border", panel("chat"))}>
          <ChatPanel
            ctx={ctx}
            className="flex-1"
            placeholder="발언 내용을 채팅으로 남길 수도 있어요"
          />
        </aside>
      </div>
      <ActionBar
        eyebrow={speaking ? "SPEAKING" : "LISTENING"}
        title={
          speaking
            ? "진술을 마치면 다음 사람에게 넘기십시오"
            : "발언자만 말할 수 있습니다. 들으면서 메모해 두세요."
        }
        desc={
          !speaking && myIndex > index && index >= 0
            ? `내 차례까지 ${myIndex - index}명`
            : undefined
        }
        tone={tone}
      >
        {speaking && (
          <button
            type="button"
            onClick={() => ctx.send("player:done", { done: true })}
            className={cn(btn.base, btn.primary)}
          >
            <Mic size={16} /> 발언 마치기
          </button>
        )}
        {ctx.me?.isHost && <HostAdvance ctx={ctx} label="투표로 넘어가기" />}
      </ActionBar>
      <MobileTabBar
        tab={tab}
        setTab={setTab}
        tabs={[
          { id: "stage", label: "진술", icon: <Users size={16} /> },
          { id: "chat", label: "기록", icon: <MessagesSquare size={16} /> },
        ]}
      />
      <ClueDetail
        ctx={ctx}
        card={detail ?? undefined}
        clue={detail ? clues[detail.id] : undefined}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
