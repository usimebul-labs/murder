"use client";

import { cn } from "@mm/ui";
import { Check, Lock, LogOut, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { josa } from "@/lib/josa";
import { Avatar, btn, Countdown, Modal } from "./primitives";
import type { GameContext, WhisperInfo } from "./types";

/** 내가 들어가 있는 밀담 (초대만 보내 둔 것 포함) */
export function myWhisper(ctx: GameContext): WhisperInfo | undefined {
  const me = ctx.myCharacterId;
  if (!me) return undefined;
  return Object.values(ctx.state.whispers ?? {}).find((w) => w.members.includes(me));
}

/** 인물 이름을 "A, B" 꼴로 */
export function whisperNames(ctx: GameContext, ids: string[]) {
  return ids.map((id) => ctx.character(id)?.name ?? "관전자").join(", ");
}

/**
 * 채팅창 위의 밀담 막대: 받은 초대, 지금 밀담, 밀담 신청.
 * 밀담은 본인 포함 최대 3인 텍스트 대화이고, 내용은 참여자에게만 전달된다
 */
export function WhisperBar({ ctx }: { ctx: GameContext }) {
  const { phase, myCharacterId: me, state } = ctx;
  const [picking, setPicking] = useState(false);
  if (!phase?.allowWhisper || !me) return null;
  const whispers = Object.values(state.whispers ?? {});
  const invites = whispers.filter((w) => w.invited.includes(me));
  const current = whispers.find((w) => w.members.includes(me));
  const max = phase.whisperMax || 3;
  const slots = current ? max - current.members.length - current.invited.length : max - 1;

  return (
    <div className="flex flex-none flex-col gap-2 border-b border-border px-3 py-2.5">
      {invites.map((w) => {
        const others = [...w.members, ...w.invited].filter((id) => id !== w.hostId && id !== me);
        return (
          <div
            key={w.id}
            className="flex flex-wrap items-center gap-2 rounded-[6px] border border-dashed border-[var(--secret-border)] bg-[var(--secret-surface)] px-3 py-2"
          >
            <Avatar character={ctx.character(w.hostId)} size={28} />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{ctx.character(w.hostId)?.name}</span>
              {others.length > 0 ? ` · ${josa(whisperNames(ctx, others), "와/과")} 함께` : ""}
              <span className="block text-xs text-muted-foreground">
                밀담 초대가 왔어요{current ? ". 수락하면 지금 밀담에서 나가요" : ""}
              </span>
            </p>
            <button
              type="button"
              onClick={() => ctx.send("whisper:respond", { whisperId: w.id, accept: false })}
              className={cn(btn.base, btn.ghost, btn.sm)}
            >
              <X size={14} /> 거절
            </button>
            <button
              type="button"
              onClick={() => ctx.send("whisper:respond", { whisperId: w.id, accept: true })}
              className={cn(btn.base, btn.primary, btn.sm)}
            >
              <Check size={14} /> 수락
            </button>
          </div>
        );
      })}

      {current ? (
        <div className="flex flex-wrap items-center gap-2">
          <Lock size={14} className="flex-none text-[var(--secret)]" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            {current.startedAt > 0 ? (
              <>
                <span className="font-semibold text-[var(--secret)]">밀담 중</span> ·{" "}
                {whisperNames(
                  ctx,
                  current.members.filter((id) => id !== me),
                )}
                {current.invited.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {whisperNames(ctx, current.invited)} 답을 기다리는 중
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="font-semibold text-[var(--secret)]">답을 기다리는 중</span> ·{" "}
                {whisperNames(ctx, current.invited)}
              </>
            )}
          </p>
          {current.endsAt > 0 && (
            <Countdown endsAt={current.endsAt} tone="var(--secret)" className="h-8 text-[13px]" />
          )}
          {slots > 0 && (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className={cn(btn.base, btn.ghost, btn.sm)}
              aria-label="밀담에 사람 더 부르기"
            >
              <UserPlus size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => ctx.send("whisper:leave", { whisperId: current.id })}
            className={cn(btn.base, btn.outline, btn.sm)}
          >
            <LogOut size={14} /> {current.startedAt > 0 ? "나가기" : "취소"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            본인 포함 {max}명까지 따로 이야기할 수 있어요
            {phase.whisperSec > 0 && ` · 한 번에 ${Math.round(phase.whisperSec / 60)}분`}
            {phase.whisperPerPlayer > 0 && ` · 신청 ${phase.whisperPerPlayer}번`}
          </p>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className={cn(
              btn.base,
              btn.sm,
              "border border-[var(--secret-border)] text-[var(--secret)] hover:bg-[var(--secret-surface)]",
            )}
          >
            <Lock size={14} /> 밀담 신청
          </button>
        </div>
      )}

      <InviteDialog
        ctx={ctx}
        open={picking}
        whisper={current}
        slots={slots}
        onClose={() => setPicking(false)}
      />
    </div>
  );
}

function InviteDialog({
  ctx,
  open,
  whisper,
  slots,
  onClose,
}: {
  ctx: GameContext;
  open: boolean;
  whisper: WhisperInfo | undefined;
  slots: number;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const taken = new Set([...(whisper?.members ?? []), ...(whisper?.invited ?? [])]);
  const others = ctx.state.characters.filter(
    (c) => c.id !== ctx.myCharacterId && ctx.playerOf(c.id) && !taken.has(c.id),
  );
  const close = () => {
    setPicked([]);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      eyebrow={whisper ? "WHISPER · INVITE" : "WHISPER"}
      title={whisper ? "누구를 더 부릅니까" : "누구와 밀담합니까"}
      footer={
        <>
          <button type="button" onClick={close} className={cn(btn.base, btn.ghost)}>
            취소
          </button>
          <button
            type="button"
            disabled={picked.length === 0}
            onClick={() => {
              ctx.send("whisper:invite", {
                characterIds: picked,
                ...(whisper ? { whisperId: whisper.id } : {}),
              });
              close();
            }}
            className={cn(btn.base, btn.primary)}
          >
            <Lock size={16} /> 초대 보내기
          </button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        {slots}명까지 고를 수 있어요. 상대가 수락하면 둘만, 또는 셋만 보이는 대화가 열려요.
      </p>
      <ul className="mt-4 grid gap-2">
        {others.map((c) => {
          const busy = !!ctx.playerOf(c.id)?.whispering;
          const on = picked.includes(c.id);
          const full = !on && picked.length >= slots;
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={busy || full}
                onClick={() =>
                  setPicked((prev) => (on ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-[6px] border bg-card px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-45",
                  on
                    ? "border-[var(--secret)] bg-[var(--secret-surface)]"
                    : "border-border hover:border-border-strong hover:bg-accent",
                )}
              >
                <Avatar character={c} size={36} />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {busy ? "다른 밀담 중" : c.role}
                  </span>
                </span>
                {on && <Check size={16} className="text-[var(--secret)]" />}
              </button>
            </li>
          );
        })}
        {others.length === 0 && (
          <li className="rounded-[6px] border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            부를 수 있는 인물이 없어요
          </li>
        )}
      </ul>
    </Modal>
  );
}

/** 밀담 안내 문구 (참여자에게만 온 시스템 메시지) */
export function WhisperNotice({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-2 py-0.5 text-center text-xs text-[var(--secret)]">
      <Lock size={11} aria-hidden />
      <span>{text}</span>
    </div>
  );
}
