"use client";

import { cn } from "@mm/ui";
import { ChevronDown, ChevronRight, NotebookPen } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import type { GameContext } from "./types";

const MAX = 2000;
/** 접기·펼치기 상태는 화면 크기별로 따로 기억한다 (넓은 화면은 펼침, 좁은 화면은 접힘이 기본) */
const OPEN_KEY = { desktop: "mm:notes-open:desktop", mobile: "mm:notes-open:mobile" } as const;

/** 수사 메모를 쓰는 게임 단계. 인물을 고른 뒤부터 최종 목표 확인까지 */
const NOTE_PHASES = new Set([
  "reading",
  "investigation",
  "discussion",
  "final-statements",
  "vote",
  "objectives-review",
]);

export function hasNotes(ctx: GameContext) {
  return (
    ctx.state.status === "playing" && !!ctx.myCharacterId && NOTE_PHASES.has(ctx.phase?.kind ?? "")
  );
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function useStoredOpen(key: string, initial: boolean) {
  const [open, setOpen] = useState(initial);
  useEffect(() => {
    const v = read(key);
    if (v !== null) setOpen(v === "1");
  }, [key]);
  const set = (next: boolean) => {
    setOpen(next);
    write(key, next ? "1" : "0");
  };
  return [open, set] as const;
}

/**
 * 게임 화면을 감싸 수사 메모를 붙인다. 모든 단계에서 같은 자리, 같은 모양으로 나온다.
 * - 넓은 화면: 오른쪽 고정 패널. 접으면 가장자리의 얇은 탭만 남고, 본문이 그만큼 넓어진다.
 * - 좁은 화면: 오른쪽 가장자리 탭을 누르면 아래에서 메모 시트가 올라온다.
 * 메모는 이 브라우저에만 저장된다.
 */
export function NotesDock({ ctx, children }: { ctx: GameContext; children: ReactNode }) {
  const storageKey = `mm:note:${ctx.roomId}:${ctx.myCharacterId}`;
  const [text, setText] = useState("");
  const [desktopOpen, setDesktopOpen] = useStoredOpen(OPEN_KEY.desktop, true);
  const [mobileOpen, setMobileOpen] = useStoredOpen(OPEN_KEY.mobile, false);

  useEffect(() => {
    setText(read(storageKey) ?? "");
  }, [storageKey]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && window.matchMedia("(max-width: 1023.98px)").matches) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onChange = (v: string) => {
    setText(v);
    write(storageKey, v);
  };
  const filled = text.trim().length > 0;

  return (
    <>
      <div
        className={cn(
          "transition-[padding] duration-300 ease-[var(--ease-quiet)]",
          desktopOpen ? "lg:pr-[300px] xl:pr-[340px]" : "lg:pr-11",
        )}
      >
        {children}
      </div>

      {/* 넓은 화면: 오른쪽 고정 패널 */}
      <aside
        aria-label="수사 메모"
        className={cn(
          "fixed inset-y-0 right-0 z-40 hidden flex-col border-l border-border bg-background transition-[width] duration-300 ease-[var(--ease-quiet)] lg:flex",
          desktopOpen ? "w-[300px] xl:w-[340px]" : "w-11",
        )}
      >
        {desktopOpen ? (
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <NotesSheet
              id="note-desktop"
              text={text}
              onChange={onChange}
              onCollapse={() => setDesktopOpen(false)}
              collapseIcon={<ChevronRight size={16} aria-hidden />}
              className="flex-1"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDesktopOpen(true)}
            aria-expanded={false}
            aria-label="수사 메모 펼치기"
            className="flex flex-1 flex-col items-center gap-3 pt-4 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <NoteIcon filled={filled} />
            <span className="font-serif text-sm font-bold tracking-[0.2em] [writing-mode:vertical-rl]">
              수사 메모
            </span>
          </button>
        )}
      </aside>

      {/* 좁은 화면: 가장자리 탭 → 아래 시트 */}
      {mobileOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex h-[min(60dvh,520px)] animate-[nm-fade-up_320ms_var(--ease-quiet)] flex-col rounded-t-[10px] border-t border-border-strong bg-background p-3 shadow-[var(--shadow-modal)] lg:hidden">
          <NotesSheet
            id="note-mobile"
            text={text}
            onChange={onChange}
            onCollapse={() => setMobileOpen(false)}
            collapseIcon={<ChevronDown size={16} aria-hidden />}
            className="flex-1"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={false}
          aria-label="수사 메모 펼치기"
          className="fixed right-0 top-[38%] z-40 flex flex-col items-center gap-2 rounded-l-[6px] border border-r-0 border-border-strong bg-[color-mix(in_oklch,var(--background)_94%,transparent)] px-2 py-3 text-muted-foreground shadow-[var(--shadow-raised)] backdrop-blur-[6px] hover:text-foreground lg:hidden"
        >
          <NoteIcon filled={filled} />
          <span className="font-serif text-xs font-bold tracking-[0.2em] [writing-mode:vertical-rl]">
            메모
          </span>
        </button>
      )}
    </>
  );
}

function NoteIcon({ filled }: { filled: boolean }) {
  return (
    <span className="relative">
      <NotebookPen size={18} aria-hidden />
      {filled && (
        <span
          className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary"
          title="적어 둔 메모가 있어요"
        />
      )}
    </span>
  );
}

/** 메모지. 넓은 화면 패널과 좁은 화면 시트가 같은 모양을 쓴다 */
function NotesSheet({
  id,
  text,
  onChange,
  onCollapse,
  collapseIcon,
  className,
}: {
  id: string;
  text: string;
  onChange: (v: string) => void;
  onCollapse: () => void;
  collapseIcon: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-[6px] border border-[var(--paper-rule)] bg-[var(--paper-surface)] text-[var(--paper-ink)] shadow-[var(--shadow-paper)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 py-1.5 pl-4 pr-1.5">
        <label htmlFor={id} className="font-serif text-lg font-bold">
          수사 메모
        </label>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[11px] text-[var(--paper-ink-muted)]">
            {text.length}/{MAX}
          </span>
          <button
            type="button"
            onClick={onCollapse}
            aria-expanded
            aria-label="수사 메모 접기"
            className="grid h-9 w-9 place-items-center rounded-[4px] text-[var(--paper-ink-muted)] hover:bg-[color-mix(in_oklch,var(--paper-ink)_8%,transparent)] hover:text-[var(--paper-ink)]"
          >
            {collapseIcon}
          </button>
        </div>
      </div>
      <textarea
        id={id}
        value={text}
        maxLength={MAX}
        onChange={(e) => onChange(e.target.value)}
        placeholder="떠오르는 의문, 엇갈리는 증언, 확인할 시각을 적어 두세요."
        className="nm-note-lines min-h-0 flex-1 resize-none bg-transparent px-4 pb-4 pt-1 font-mono text-sm leading-7 outline-none placeholder:text-[var(--paper-ink-muted)]"
      />
      <p className="border-t border-dashed border-[var(--paper-rule)] px-4 py-2 text-[11px] text-[var(--paper-ink-muted)]">
        메모는 나만 볼 수 있어요. 이 브라우저에 저장돼요.
      </p>
    </div>
  );
}
