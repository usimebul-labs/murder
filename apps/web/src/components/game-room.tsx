"use client";

import type { Room } from "@colyseus/sdk";
import {
  type ChatMessage,
  type ClientMessages,
  type CreateRoomOptions,
  ROOM_NAME,
  type ServerMessages,
} from "@mm/game-protocol";
import { Button, cn } from "@mm/ui";
import { useEffect, useRef, useState } from "react";
import { createGameClient } from "@/lib/game-client";

/** 서버 GameState를 toJSON()한 모양 (게임 서버 state.ts와 맞춘다) */
interface GameSnapshot {
  status: "lobby" | "playing" | "finished";
  scenarioTitle: string;
  characters: { id: string; name: string; publicProfile: string; colorIndex: number }[];
  phases: { id: string; kind: string; title: string; durationSec: number; allowWhisper: boolean }[];
  phaseIndex: number;
  phaseEndsAt: number;
  players: Record<
    string,
    {
      nickname: string;
      characterId: string;
      ready: boolean;
      connected: boolean;
      isHost: boolean;
      hasVoted: boolean;
    }
  >;
  clues: Record<
    string,
    { id: string; code: string; title: string; body: string; sharedBy: string }
  >;
  accusedCharacterId: string;
  endingId: string;
}

export function GameRoom({
  scenarioVersionId,
  roomId,
}: {
  scenarioVersionId: string;
  roomId?: string;
}) {
  const [nickname, setNickname] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<GameSnapshot | null>(null);
  const [script, setScript] = useState<ServerMessages["character:script"] | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => () => void roomRef.current?.leave(), []);

  async function connect() {
    try {
      const client = await createGameClient(nickname || undefined);
      const joined = roomId
        ? await client.joinById(roomId, { nickname })
        : await client.create(ROOM_NAME, {
            scenarioVersionId,
            nickname,
          } satisfies CreateRoomOptions & { nickname: string });
      roomRef.current = joined;
      setRoom(joined);
      if (!roomId) {
        window.history.replaceState(null, "", `?room=${joined.roomId}`);
      }
      joined.onStateChange((s: { toJSON(): GameSnapshot }) => setState(s.toJSON()));
      joined.onMessage("character:script", (m: ServerMessages["character:script"]) => setScript(m));
      joined.onMessage("chat:message", (m: ChatMessage) => setChat((prev) => [...prev, m]));
      joined.onMessage("error", (m: ServerMessages["error"]) => setError(m.message));
      joined.onMessage("*", () => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function send<K extends keyof ClientMessages>(type: K, payload: ClientMessages[K]) {
    setError(null);
    room?.send(type, payload);
  }

  if (!room || !state) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
        <h1 className="font-display text-3xl">{roomId ? "사건 현장에 합류" : "새 사건 열기"}</h1>
        <input
          className="h-11 rounded-md border border-input bg-[var(--input-bg)] px-3"
          placeholder="닉네임"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <Button onClick={connect}>입장</Button>
        {error && <p className="text-sm text-[var(--destructive-text)]">{error}</p>}
      </main>
    );
  }

  const me = state.players[room.sessionId];
  const phase = state.phaseIndex >= 0 ? state.phases[state.phaseIndex] : undefined;
  const characterName = (id: string) => state.characters.find((c) => c.id === id)?.name ?? id;

  return (
    <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:grid-cols-2">
      <section className="space-y-4">
        <header>
          <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">
            ROOM · {room.roomId}
          </p>
          <h1 className="font-display text-2xl">{state.scenarioTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {state.status === "lobby" && "대기실: 캐릭터를 고르고 준비하세요"}
            {state.status === "playing" && phase && `진행 중: ${phase.title}`}
            {state.status === "finished" && "사건 종료"}
            {phase?.kind === "ending" &&
              ` · 지목: ${characterName(state.accusedCharacterId) || "없음"}`}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2">
          {state.characters.map((c) => {
            const owner = Object.values(state.players).find((p) => p.characterId === c.id);
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-lg border border-border bg-card p-3",
                  me?.characterId === c.id && "border-primary",
                )}
              >
                <button
                  type="button"
                  disabled={state.status !== "lobby"}
                  onClick={() => send("character:select", { characterId: c.id })}
                  className="w-full text-left"
                >
                  <p className="font-semibold" style={{ color: `var(--char-${c.colorIndex})` }}>
                    {c.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {owner ? owner.nickname : "비어 있음"}
                  </p>
                </button>
                {phase?.kind === "vote" && (
                  <button
                    type="button"
                    className="mt-2 text-xs underline"
                    onClick={() => send("vote:cast", { suspectCharacterId: c.id })}
                  >
                    범인으로 지목
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          {state.status === "lobby" && (
            <Button variant="secondary" onClick={() => send("player:ready", { ready: !me?.ready })}>
              {me?.ready ? "준비 취소" : "준비 완료"}
            </Button>
          )}
          {me?.isHost && state.status !== "finished" && (
            <Button onClick={() => send("phase:advance", {})}>
              {state.status === "lobby" ? "사건 시작" : "다음 단계"}
            </Button>
          )}
          {phase?.kind === "investigation" && (
            <Button
              variant="secondary"
              onClick={() => send("clue:investigate", { location: "study" })}
            >
              서재 조사
            </Button>
          )}
        </div>

        {script && (
          <article className="rounded-lg bg-paper p-4 font-serif text-paper-ink">
            <p className="font-mono text-xs">PRIVATE · {characterName(script.characterId)}</p>
            <p className="mt-2 whitespace-pre-wrap">{script.privateScript}</p>
          </article>
        )}

        <div className="space-y-2">
          <h2 className="font-serif text-lg font-bold">단서</h2>
          {Object.values(state.clues).length === 0 && (
            <p className="text-sm text-muted-foreground">아직 얻은 단서가 없습니다</p>
          )}
          {Object.values(state.clues).map((clue) => (
            <div
              key={clue.id}
              className="rounded-lg border border-[var(--clue-border)] bg-[var(--clue-surface)] p-3"
            >
              <p className="font-mono text-xs">{clue.code}</p>
              <p className="font-semibold">{clue.title}</p>
              <p className="text-sm">{clue.body}</p>
              {!clue.sharedBy && (
                <button
                  type="button"
                  className="mt-1 text-xs underline"
                  onClick={() => send("clue:share", { clueId: clue.id })}
                >
                  모두에게 공개
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <ChatPanel
        messages={chat}
        characterName={characterName}
        onSend={(text) => send("chat:send", { channel: "all", text })}
      />
      {error && <p className="text-sm text-[var(--destructive-text)] lg:col-span-2">{error}</p>}
    </main>
  );
}

function ChatPanel({
  messages,
  characterName,
  onSend,
}: {
  messages: ChatMessage[];
  characterName: (id: string) => string;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <section className="flex min-h-80 flex-col rounded-lg border border-border bg-card">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m) => (
          <p key={m.id} className="text-sm">
            <span className="font-semibold">
              {m.characterId ? characterName(m.characterId) : "관전자"}
            </span>{" "}
            {m.text}
          </p>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSend(text);
          setText("");
        }}
      >
        <input
          className="h-10 flex-1 rounded-md border border-input bg-[var(--input-bg)] px-3 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="발언하기"
        />
        <Button type="submit">전송</Button>
      </form>
    </section>
  );
}
