"use client";

import { cn } from "@mm/ui";
import { Lock, Megaphone, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./primitives";
import type { ChatMessage, GameContext } from "./types";

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

/** 대화 기록 + 입력창. 밀담이 열린 페이즈에서는 상대를 골라 귓속말을 보낼 수 있다 */
export function ChatPanel({
  ctx,
  title = "대화",
  placeholder = "발언을 남기세요",
  className,
  readOnly,
}: {
  ctx: GameContext;
  title?: string;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}) {
  const { chat, phase, myCharacterId, state } = ctx;
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string>("all");
  const endRef = useRef<HTMLDivElement>(null);
  const whisperOpen = !!phase?.allowWhisper && !!myCharacterId;
  const channel = whisperOpen && target !== "all" ? (`whisper:${target}` as const) : "all";

  // biome-ignore lint/correctness/useExhaustiveDependencies: 새 메시지가 오면 맨 아래로
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.length]);

  const others = state.characters.filter(
    (c) =>
      c.id !== myCharacterId && Object.values(state.players).some((p) => p.characterId === c.id),
  );

  return (
    <section className={cn("flex min-h-0 flex-col", className)} aria-label={title}>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {chat.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            아직 남겨진 대화가 없습니다
          </p>
        )}
        {chat.map((m) => (
          <Message key={m.id} m={m} ctx={ctx} />
        ))}
        <div ref={endRef} />
      </div>
      {!readOnly && (
        <form
          className="flex flex-none flex-col gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            ctx.send("chat:send", { channel, text });
            setText("");
          }}
        >
          {whisperOpen && (
            <div className="flex flex-wrap items-center gap-1.5">
              <ChannelChip active={target === "all"} onClick={() => setTarget("all")}>
                전체
              </ChannelChip>
              {others.map((c) => (
                <ChannelChip
                  key={c.id}
                  active={target === c.id}
                  onClick={() => setTarget(c.id)}
                  whisper
                >
                  <Lock size={11} aria-hidden /> {c.name.split(" ")[0]}
                </ChannelChip>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              aria-label="메시지"
              className={cn(
                "h-11 min-w-0 flex-1 rounded-[3px] border border-input bg-[var(--input-bg)] px-3 text-sm shadow-[var(--shadow-inset)] outline-none focus:border-ring",
                channel !== "all" && "border-dashed border-[var(--secret-border)]",
              )}
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                channel !== "all" ? `${ctx.character(target)?.name}에게만 보이는 밀담` : placeholder
              }
            />
            <button
              type="submit"
              aria-label="보내기"
              className="grid h-11 w-11 flex-none place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function ChannelChip({
  active,
  onClick,
  whisper,
  children,
}: {
  active: boolean;
  onClick: () => void;
  whisper?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold",
        active
          ? whisper
            ? "border-[var(--secret)] bg-[var(--secret-surface)] text-[var(--secret)]"
            : "border-primary bg-[var(--clue-surface)] text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Message({ m, ctx }: { m: ChatMessage; ctx: GameContext }) {
  if (m.channel === "gm") {
    return (
      <div className="flex items-start justify-center gap-2 px-2 py-1 text-center">
        <Megaphone size={12} className="mt-1 flex-none text-primary" aria-hidden />
        <p className="font-serif text-[13px] leading-relaxed text-[var(--paper-300)]">
          {m.text}
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">{time(m.sentAt)}</span>
        </p>
      </div>
    );
  }
  const character = m.characterId ? ctx.character(m.characterId) : undefined;
  const mine = m.fromSessionId === ctx.sessionId;
  const whisperTo = m.channel.startsWith("whisper:") ? m.channel.slice(8) : null;
  const nickname = m.fromSessionId ? ctx.state.players[m.fromSessionId]?.nickname : undefined;
  return (
    <div className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
      <Avatar character={character} size={34} />
      <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-1", mine && "items-end")}>
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
          <span
            className="font-semibold"
            style={{ color: character ? `var(--char-${character.colorIndex})` : undefined }}
          >
            {character?.name ?? nickname ?? "관전자"}
          </span>
          {character?.role && <span className="text-muted-foreground">{character.role}</span>}
          <span className="font-mono text-[11px] text-muted-foreground">{time(m.sentAt)}</span>
        </p>
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-md border px-3 py-2 text-sm leading-relaxed",
            whisperTo
              ? "border-dashed border-[var(--secret-border)] bg-[var(--secret-surface)]"
              : mine
                ? "border-[var(--clue-border)] bg-[var(--clue-surface)]"
                : "border-border bg-card",
          )}
        >
          {whisperTo && (
            <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--secret)]">
              <Lock size={11} aria-hidden /> 밀담 ·{" "}
              {mine ? `${ctx.character(whisperTo)?.name}에게` : "나에게"}
            </span>
          )}
          <Styled text={m.text} />
        </div>
      </div>
    </div>
  );
}

/** *행동 묘사*는 이탤릭 세리프로 */
function Styled({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 분할 결과
          <em key={i} className="font-serif text-muted-foreground">
            {p.slice(1, -1)}
          </em>
        ) : (
          p
        ),
      )}
    </>
  );
}
