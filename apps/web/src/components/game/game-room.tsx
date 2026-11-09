"use client";

import { cn } from "@mm/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { btn, Eyebrow, Toasts } from "./primitives";
import { Reading } from "./screens/dossier";
import { Ending, FinalVote, Objectives } from "./screens/finale";
import { CharacterSelect, Prologue } from "./screens/intro";
import { Lobby } from "./screens/lobby";
import { Discussion, Explore, Statements } from "./screens/rounds";
import type { GameContext } from "./types";
import { AUTO_JOIN, useGame } from "./use-game";

export function GameRoom({
  scenarioVersionId,
  roomId,
}: {
  scenarioVersionId: string;
  roomId?: string;
}) {
  const game = useGame(scenarioVersionId, roomId);
  const { room, state } = game;

  const ctx = useMemo<GameContext | null>(() => {
    if (!room || !state) return null;
    const me = state.players[room.sessionId];
    const phase = state.phaseIndex >= 0 ? state.phases[state.phaseIndex] : undefined;
    return {
      roomId: room.roomId,
      sessionId: room.sessionId,
      state,
      scenario: game.scenario,
      script: game.script,
      chat: game.chat,
      me,
      myCharacterId: me?.characterId ?? "",
      phase,
      send: game.send,
      character: (id) => state.characters.find((c) => c.id === id),
      playerOf: (characterId) =>
        characterId
          ? Object.values(state.players).find((p) => p.characterId === characterId)
          : undefined,
    };
  }, [room, state, game.scenario, game.script, game.chat, game.send]);

  // 페이즈가 바뀌면 화면 맨 위로
  const phaseKey = `${state?.status}-${state?.phaseIndex}`;
  const lastPhase = useRef(phaseKey);
  useEffect(() => {
    if (lastPhase.current !== phaseKey) window.scrollTo({ top: 0 });
    lastPhase.current = phaseKey;
  }, [phaseKey]);

  const { toast } = game;
  const copyLink = useCallback(() => {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => toast({ tone: "info", title: "초대 링크를 복사했습니다" }))
      .catch(() =>
        toast({ tone: "error", title: "복사하지 못했습니다. 주소창의 링크를 공유해 주세요" }),
      );
  }, [toast]);

  if (!ctx && roomId && AUTO_JOIN) {
    return (
      <EnteringScreen
        connecting={game.connecting || (!game.error && !room)}
        error={game.error}
        onRetry={() => game.connect("", false)}
      />
    );
  }

  if (!ctx) {
    return (
      <JoinScreen
        joining={!!roomId}
        connecting={game.connecting}
        error={game.error}
        onJoin={(nickname, preview) => game.connect(nickname, preview)}
      />
    );
  }

  return (
    <>
      <Screen ctx={ctx} onCopyLink={copyLink} />
      {game.error && (
        <p className="fixed inset-x-0 bottom-0 z-50 bg-[var(--accused-surface)] px-4 py-2 text-center text-sm text-[var(--destructive-text)]">
          {game.error}
        </p>
      )}
      <Toasts toasts={game.toasts} onDismiss={game.dismiss} />
    </>
  );
}

function Screen({ ctx, onCopyLink }: { ctx: GameContext; onCopyLink: () => void }) {
  const { state, phase } = ctx;
  if (state.status === "lobby") return <Lobby ctx={ctx} onCopyLink={onCopyLink} />;
  if (state.status === "finished") return <Ending ctx={ctx} />;
  switch (phase?.kind) {
    case "intro":
      return <Prologue ctx={ctx} />;
    case "character-select":
      return <CharacterSelect ctx={ctx} />;
    case "reading":
      return <Reading ctx={ctx} />;
    case "investigation":
      return <Explore ctx={ctx} />;
    case "discussion":
      return <Discussion ctx={ctx} />;
    case "final-statements":
      return <Statements ctx={ctx} />;
    case "vote":
      return <FinalVote ctx={ctx} />;
    case "objectives-review":
      return <Objectives ctx={ctx} />;
    case "ending":
      return <Ending ctx={ctx} />;
    default:
      return null;
  }
}

/** 초대 링크로 들어올 때: 닉네임을 묻지 않고 계정 닉네임으로 바로 입장한다 */
function EnteringScreen({
  connecting,
  error,
  onRetry,
}: {
  connecting: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <main className="nm-scene relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4">
      <div className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-[6px] border border-border bg-card/95 p-6 text-center shadow-[var(--shadow-raised)]">
        <Eyebrow tone="var(--primary)">INVITATION · 초대장</Eyebrow>
        {error && !connecting ? (
          <>
            <h1 className="font-display text-2xl font-semibold">입장하지 못했습니다</h1>
            <p className="text-sm text-[var(--destructive-text)]">{error}</p>
            <div className="flex gap-2">
              <a href="/" className={cn(btn.base, btn.ghost)}>
                로비로
              </a>
              {error.includes("로그인") ? (
                <a
                  href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                  className={cn(btn.base, btn.primary)}
                >
                  로그인
                </a>
              ) : (
                <button type="button" className={cn(btn.base, btn.primary)} onClick={onRetry}>
                  다시 시도
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold">대기실로 들어가는 중</h1>
            <p className="text-sm text-muted-foreground" role="status">
              잠시만 기다려 주십시오.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function JoinScreen({
  joining,
  connecting,
  error,
  onJoin,
}: {
  joining: boolean;
  connecting: boolean;
  error: string | null;
  onJoin: (nickname: string, preview: boolean) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [preview, setPreview] = useState(false);
  return (
    <main className="nm-scene relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4">
      {/* biome-ignore lint/performance/noImgElement: 정적 SVG 표지 */}
      <img
        src="/scenarios/blackwood-manor/cover/cover.svg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_50%,transparent,var(--ink-950))]" />
      <form
        className="relative flex w-full max-w-md flex-col gap-4 rounded-[6px] border border-border bg-card/95 p-6 shadow-[var(--shadow-raised)]"
        onSubmit={(e) => {
          e.preventDefault();
          onJoin(nickname.trim(), preview);
        }}
      >
        <Eyebrow tone="var(--primary)">
          {joining ? "INVITATION · 초대장" : "CASE FILE · 01"}
        </Eyebrow>
        <h1 className="font-display text-3xl font-semibold">
          {joining ? "사건 현장에 합류" : "새 사건 열기"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          블랙우드 저택의 마지막 만찬 · 6인 · 약 160분.{" "}
          {joining
            ? "닉네임을 정하고 대기실로 들어가십시오."
            : "방을 만들면 초대 링크를 함께할 사람들에게 보내 주세요."}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">닉네임</span>
          <input
            className="h-11 rounded-[3px] border border-input bg-[var(--input-bg)] px-3 shadow-[var(--shadow-inset)] outline-none focus:border-ring"
            placeholder="예: 레이븐"
            maxLength={20}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>
        {!joining && (
          <label className="flex cursor-pointer items-start gap-3 py-1 text-sm">
            <input
              type="checkbox"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-[var(--primary)]"
            />
            <span>
              테스트 방으로 열기
              <span className="block text-xs text-muted-foreground">
                6명이 모이지 않아도 시작할 수 있어요
              </span>
            </span>
          </label>
        )}
        <button type="submit" disabled={connecting} className={cn(btn.base, btn.primary, btn.lg)}>
          {connecting ? "입장하는 중…" : joining ? "입장" : "방 만들기"}
        </button>
        {error && <p className="text-sm text-[var(--destructive-text)]">{error}</p>}
      </form>
    </main>
  );
}
