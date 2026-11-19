"use client";

import { cn } from "@mm/ui";
import { Eye, Grid3x3, LayoutGrid, Lock, RotateCcw } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Avatar, CATEGORY, ClueCard, Eyebrow } from "./primitives";
import type { ClueCardInfo, ClueInfo, GameContext } from "./types";

/*
 * 토론 단계의 단서판.
 * - 공개 단서와 내 단서를 한 판에 조밀하게 늘어놓아 많은 단서를 한눈에 본다.
 * - 카드를 끌어 순서를 바꿀 수 있다. 배치는 이 브라우저에만 저장되고 서버로 보내지 않는다.
 */

type View = "all" | "public" | "mine";
type Density = "dense" | "detail";

const DENSITY_KEY = "mm:board-density";
const orderKey = (ctx: GameContext) => `mm:board-order:${ctx.roomId}:${ctx.myCharacterId}`;

/** 터치는 길게 눌러야 끌기가 시작된다 (그 전에 움직이면 스크롤) */
const LONG_PRESS_MS = 280;
/** 마우스는 이만큼 움직여야 끌기로 본다 (그 전에 떼면 클릭) */
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 8;
/** 스크롤 영역 가장자리에서 자동 스크롤이 시작되는 거리 */
const EDGE = 56;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

function readOrder(key: string): string[] {
  try {
    const v = JSON.parse(read(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const owner = (c: ClueCardInfo) => c.sharedBy || c.holderId;

const byDefault = (a: ClueCardInfo, b: ClueCardInfo) =>
  a.round - b.round || a.code.localeCompare(b.code, "en", { numeric: true });

/** 저장된 순서를 따르고, 새로 생긴 단서는 기본 순서로 뒤에 붙인다 */
export function arrange(cards: ClueCardInfo[], saved: string[]) {
  const rank = new Map(saved.map((id, i) => [id, i]));
  const known = cards.filter((c) => rank.has(c.id));
  const fresh = cards.filter((c) => !rank.has(c.id)).sort(byDefault);
  known.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  return [...known, ...fresh];
}

/** fromId를 toId 자리로 옮긴 순서 */
export function moveTo(ids: string[], fromId: string, toId: string) {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

function useBoardOrder(ctx: GameContext, cards: ClueCardInfo[]) {
  const key = orderKey(ctx);
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => setSaved(readOrder(key)), [key]);
  const ordered = useMemo(() => arrange(cards, saved), [cards, saved]);
  const commit = useCallback(
    (ids: string[]) => {
      setSaved(ids);
      write(key, JSON.stringify(ids));
    },
    [key],
  );
  const reset = useCallback(() => {
    setSaved([]);
    write(key, null);
  }, [key]);
  return { ordered, saved, commit, reset, custom: saved.length > 0 };
}

function useDensity() {
  const [density, setDensity] = useState<Density>("dense");
  useEffect(() => {
    const v = read(DENSITY_KEY);
    if (v === "dense" || v === "detail") setDensity(v);
  }, []);
  const set = (d: Density) => {
    setDensity(d);
    write(DENSITY_KEY, d);
  };
  return [density, set] as const;
}

interface DragState {
  id: string;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  w: number;
  h: number;
  active: boolean;
  timer?: number;
}

/**
 * 포인터로 끌어 순서 바꾸기. 마우스와 터치를 같은 코드로 다룬다.
 * 끄는 동안에는 순서를 바로 바꿔 보여 주고, 놓을 때 저장한다.
 */
function useDragSort({
  ids,
  onPreview,
  onCommit,
  onAbort,
  scrollRef,
}: {
  ids: string[];
  onPreview: (fromId: string, toId: string) => void;
  onCommit: () => void;
  onAbort: () => void;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const previewRef = useRef(onPreview);
  previewRef.current = onPreview;
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const abortRef = useRef(onAbort);
  abortRef.current = onAbort;

  const paint = useCallback(() => {
    const d = drag.current;
    if (!d?.active) return;
    setDragging({ id: d.id, x: d.x - d.offsetX, y: d.y - d.offsetY, w: d.w, h: d.h });
  }, []);

  const hitTest = useCallback(() => {
    const d = drag.current;
    if (!d?.active) return;
    const el = document.elementFromPoint(d.x, d.y)?.closest<HTMLElement>("[data-clue-id]");
    const target = el?.dataset.clueId;
    if (target && target !== d.id && idsRef.current.includes(target)) {
      previewRef.current(d.id, target);
    }
  }, []);

  // 끄는 동안 가장자리에 머물면 계속 스크롤한다
  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    const tick = () => {
      const d = drag.current;
      const box = scrollRef.current;
      if (d?.active && box) {
        const r = box.getBoundingClientRect();
        const dy =
          d.y < r.top + EDGE
            ? -Math.ceil((r.top + EDGE - d.y) / 4)
            : d.y > r.bottom - EDGE
              ? Math.ceil((d.y - (r.bottom - EDGE)) / 4)
              : 0;
        if (dy) {
          box.scrollTop += dy;
          hitTest();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dragging, scrollRef, hitTest]);

  const end = useCallback((commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    window.clearTimeout(d.timer);
    drag.current = null;
    if (d.active) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      setDragging(null);
      if (commit) commitRef.current();
      else abortRef.current();
    }
  }, []);

  useEffect(() => {
    const onMove = (e: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      d.x = e.clientX;
      d.y = e.clientY;
      const moved = Math.hypot(d.x - d.startX, d.y - d.startY);
      if (!d.active) {
        if (d.touch) {
          // 길게 누르기 전에 움직이면 스크롤하려는 것
          if (moved > TOUCH_SLOP) end(false);
          return;
        }
        if (moved < MOUSE_SLOP) return;
        d.active = true;
      }
      paint();
      hitTest();
    };
    const onUp = (e: globalThis.PointerEvent) => {
      if (drag.current && e.pointerId === drag.current.pointerId) end(true);
    };
    const onCancel = (e: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      // 터치로 끄는 중이면 브라우저가 포인터를 놓아도 touchend까지 이어 간다
      if (d.touch && d.active) return;
      end(false);
    };
    // 끌기가 시작된 뒤에는 화면이 스크롤되지 않게 막고, 터치 위치로 따라간다
    const onTouchMove = (e: TouchEvent) => {
      const d = drag.current;
      if (!d?.active || !d.touch) return;
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      d.x = t.clientX;
      d.y = t.clientY;
      paint();
      hitTest();
    };
    const onTouchEnd = (e: TouchEvent) => {
      const d = drag.current;
      if (d?.touch && e.touches.length === 0) end(d.active);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && drag.current?.active) end(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [end, paint, hitTest]);

  const onPointerDown = (id: string) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || drag.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const touch = e.pointerType !== "mouse";
    const d: DragState = {
      id,
      pointerId: e.pointerId,
      touch,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - r.left,
      offsetY: e.clientY - r.top,
      w: r.width,
      h: r.height,
      active: false,
    };
    if (touch) {
      d.timer = window.setTimeout(() => {
        if (drag.current !== d) return;
        d.active = true;
        navigator.vibrate?.(12);
        paint();
      }, LONG_PRESS_MS);
    }
    drag.current = d;
  };

  return {
    dragging,
    onPointerDown,
    /** 끌기를 마친 직후의 클릭은 무시한다 */
    shouldIgnoreClick: () => suppressClick.current,
  };
}

/* ───────────── 화면 ───────────── */

export function DiscussionBoard({
  ctx,
  cards,
  clues,
  scrollRef,
  onOpen,
}: {
  ctx: GameContext;
  /** 내가 볼 수 있는 단서: 공개 단서 + 내 단서 */
  cards: ClueCardInfo[];
  clues: Record<string, ClueInfo>;
  scrollRef: RefObject<HTMLElement | null>;
  onOpen: (card: ClueCardInfo) => void;
}) {
  const { myCharacterId } = ctx;
  const [view, setView] = useState<View>("all");
  const [holder, setHolder] = useState("all");
  const [density, setDensity] = useDensity();
  const { ordered, commit, reset, custom } = useBoardOrder(ctx, cards);
  const [preview, setPreviewState] = useState<string[] | null>(null);
  const previewRef = useRef<string[] | null>(null);
  const setPreview = (next: string[] | null) => {
    previewRef.current = next;
    setPreviewState(next);
  };

  const isMine = (c: ClueCardInfo) => !!myCharacterId && c.holderId === myCharacterId;
  const inView = (c: ClueCardInfo) =>
    (view === "all" || (view === "public" ? c.isPublic : isMine(c))) &&
    (holder === "all" || owner(c) === holder);

  const allIds = preview ?? ordered.map((c) => c.id);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const list = allIds.map((id) => byId.get(id)).filter((c): c is ClueCardInfo => !!c && inView(c));

  const holders = useMemo(() => {
    const ids = new Set(cards.map(owner).filter(Boolean));
    return ctx.state.characters.filter((c) => ids.has(c.id));
  }, [cards, ctx.state.characters]);

  const counts = {
    all: cards.length,
    public: cards.filter((c) => c.isPublic).length,
    mine: cards.filter(isMine).length,
  };

  const sort = useDragSort({
    ids: list.map((c) => c.id),
    scrollRef,
    onPreview: (from, to) =>
      setPreview(moveTo(previewRef.current ?? ordered.map((c) => c.id), from, to)),
    onCommit: () => {
      if (previewRef.current) commit(previewRef.current);
      setPreview(null);
    },
    onAbort: () => setPreview(null),
  });

  /** 키보드: Alt + 방향키로 한 칸씩 옮긴다 */
  const onKeyDown = (card: ClueCardInfo) => (e: KeyboardEvent<HTMLElement>) => {
    if (!e.altKey) return;
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = list.findIndex((c) => c.id === card.id);
    const target = list[i + step];
    if (target)
      commit(
        moveTo(
          ordered.map((c) => c.id),
          card.id,
          target.id,
        ),
      );
  };

  const dragged = sort.dragging ? byId.get(sort.dragging.id) : undefined;

  return (
    <div className="space-y-3 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div>
          <Eyebrow>CLUE BOARD</Eyebrow>
          <h2 className="mt-0.5 font-serif text-2xl font-bold">단서판</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {custom && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("단서 배치를 처음 순서로 되돌릴까요?")) reset();
              }}
              className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw size={14} aria-hidden /> 순서 초기화
            </button>
          )}
          <div className="flex rounded-md border border-border bg-[var(--input-bg)] p-[3px]">
            {(
              [
                ["dense", "한눈에", <Grid3x3 key="d" size={15} aria-hidden />],
                ["detail", "자세히", <LayoutGrid key="l" size={15} aria-hidden />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={density === id}
                onClick={() => setDensity(id)}
                title={label}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-[3px] px-2 text-xs font-semibold text-muted-foreground",
                  density === id && "bg-accent text-foreground",
                )}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex flex-none rounded-md border border-border bg-[var(--input-bg)] p-[3px]"
          role="tablist"
          aria-label="단서 범위"
        >
          {(
            [
              ["all", "전체"],
              ["public", "공개"],
              ["mine", "내 단서"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-[3px] px-2.5 text-xs font-semibold text-muted-foreground",
                view === id && "bg-accent text-foreground",
              )}
            >
              {label}
              <span className="font-mono text-[11px] opacity-70">{counts[id]}</span>
            </button>
          ))}
        </div>
        {holders.length > 1 && (
          <div className="-my-1 flex min-w-0 gap-1 overflow-x-auto py-1">
            {[{ id: "all", name: "모두" }, ...holders].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={holder === c.id}
                onClick={() => setHolder(holder === c.id ? "all" : c.id)}
                title={c.name}
                className={cn(
                  "inline-flex h-8 flex-none items-center gap-1 rounded-full border px-2 text-xs font-semibold",
                  holder === c.id
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {c.id !== "all" && <Avatar character={ctx.character(c.id)} size={18} />}
                <span className={cn(c.id !== "all" && "hidden sm:inline")}>
                  {c.name.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        카드를 끌어 순서를 바꿀 수 있어요(휴대폰은 길게 누른 뒤 끌기). 배치는 내 화면에만 저장돼요.
      </p>

      <ul
        className={cn(
          "grid",
          density === "dense"
            ? "gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(6.25rem,1fr))] sm:gap-2 sm:[grid-template-columns:repeat(auto-fill,minmax(6.75rem,1fr))]"
            : "grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
        )}
        aria-label="단서 목록"
      >
        {list.map((card) => {
          const placeholder = sort.dragging?.id === card.id;
          return (
            <li
              key={card.id}
              data-clue-id={card.id}
              className={cn(
                "relative rounded-[6px]",
                placeholder &&
                  "outline-2 outline-dashed outline-[var(--brass-500)] [&>*]:opacity-25",
              )}
            >
              <BoardCard
                ctx={ctx}
                card={card}
                clue={clues[card.id]}
                density={density}
                onPointerDown={sort.onPointerDown(card.id)}
                onKeyDown={onKeyDown(card)}
                onClick={() => {
                  if (!sort.shouldIgnoreClick()) onOpen(card);
                }}
              />
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="col-span-full rounded-[6px] border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {view === "mine"
              ? "가진 단서가 없습니다"
              : view === "public"
                ? "아직 공개된 단서가 없습니다"
                : "볼 수 있는 단서가 없습니다"}
          </li>
        )}
      </ul>

      {sort.dragging && dragged && (
        <div
          className="pointer-events-none fixed top-0 left-0 z-50 rotate-[-2deg] opacity-95 drop-shadow-2xl"
          style={{
            width: sort.dragging.w,
            height: sort.dragging.h,
            transform: `translate(${sort.dragging.x}px, ${sort.dragging.y}px) rotate(-2deg)`,
          }}
          aria-hidden
        >
          <BoardCard ctx={ctx} card={dragged} clue={clues[dragged.id]} density={density} lifted />
        </div>
      )}
    </div>
  );
}

function OwnerTag({ ctx, card, short }: { ctx: GameContext; card: ClueCardInfo; short?: boolean }) {
  const id = card.sharedBy || card.holderId;
  if (!id) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold">
        <Eye size={12} aria-hidden /> 공통{short ? "" : " 자료"}
      </span>
    );
  }
  const c = ctx.character(id);
  const me = id === ctx.myCharacterId;
  const name = me ? "나" : short ? c?.name.split(" ")[0] : c?.name;
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Avatar character={c} size={short ? 16 : 18} />
      <span className="truncate">
        {card.sharedBy ? (short ? name : `${me ? "당신이" : name} 공개`) : name}
      </span>
    </span>
  );
}

function BoardCard({
  ctx,
  card,
  clue,
  density,
  lifted,
  onClick,
  onPointerDown,
  onKeyDown,
}: {
  ctx: GameContext;
  card: ClueCardInfo;
  clue?: ClueInfo;
  density: Density;
  lifted?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const secret = card.holderId === ctx.myCharacterId && !card.isPublic;
  const dragProps = {
    onPointerDown,
    onKeyDown,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    "aria-roledescription": "옮길 수 있는 단서",
    "aria-keyshortcuts": "Alt+ArrowLeft Alt+ArrowRight",
  };

  if (density === "detail") {
    return (
      <div
        {...dragProps}
        className="h-full touch-manipulation select-none [-webkit-touch-callout:none]"
      >
        <ClueCard
          card={card}
          clue={clue}
          className={cn("h-full w-full", lifted && "border-[var(--brass-400)]")}
          onClick={onClick}
          holder={<OwnerTag ctx={ctx} card={card} />}
          footer={
            secret ? <span className="font-semibold text-[var(--secret)]">비공개</span> : undefined
          }
        />
      </div>
    );
  }

  const category = clue?.category ?? card.category;
  const Icon = CATEGORY[category].icon;
  return (
    <button
      type="button"
      {...dragProps}
      onClick={onClick}
      title={clue ? `${card.code} ${clue.title}` : card.code}
      className={cn(
        "flex h-full min-h-[4.75rem] w-full flex-col gap-0.5 overflow-hidden rounded-[6px] border px-2 py-1.5 text-left text-[var(--paper-ink)] shadow-[var(--shadow-paper)]",
        "touch-manipulation select-none border-[var(--paper-rule)] bg-[var(--paper-surface)] transition-[border-color,transform] duration-150 [-webkit-touch-callout:none]",
        "cursor-grab hover:border-[var(--brass-500)] active:cursor-grabbing",
        secret && "border-l-[3px] border-l-[var(--secret)]",
        lifted && "cursor-grabbing border-[var(--brass-400)]",
      )}
    >
      <span className="flex items-center justify-between gap-1 text-[var(--paper-ink-muted)]">
        <span className="inline-flex min-w-0 items-center gap-1">
          <Icon size={12} aria-hidden className="flex-none" />
          <span className="font-mono text-[10.5px] font-bold tracking-[0.04em]">{card.code}</span>
        </span>
        {secret && (
          <Lock size={11} className="flex-none text-[var(--secret)]" aria-label="비공개" />
        )}
      </span>
      <span className="line-clamp-2 font-serif text-[13px] leading-snug font-bold break-keep">
        {clue?.title ?? card.source}
      </span>
      <span className="mt-auto flex min-w-0 items-center text-[11px] text-[var(--paper-ink-muted)]">
        <OwnerTag ctx={ctx} card={card} short />
      </span>
    </button>
  );
}
