"use client";

import { cn } from "@mm/ui";
import { ChevronLeft, ChevronRight, CircleCheck, Shuffle } from "lucide-react";
import { useRef, useState } from "react";
import { josa } from "@/lib/josa";
import { ActionBar, Avatar, asset, btn, Countdown, Eyebrow, Portrait, TopBar } from "../primitives";
import type { GameContext } from "../types";

/** 오프닝: 프롤로그를 한 장씩 넘긴다 */
export function Prologue({ ctx }: { ctx: GameContext }) {
  const { scenario, state, me, phase } = ctx;
  const [page, setPage] = useState(0);
  const chapters = scenario?.prologue ?? [];
  const total = chapters.length + 1;
  const players = Object.values(state.players);
  const done = players.filter((p) => p.done).length;
  const chapter = page > 0 ? chapters[page - 1] : undefined;
  const scroller = useRef<HTMLElement>(null);
  /** 소설을 천천히 읽는 속도(분당 450자 안팎)로 잡은 예상 읽기 시간 */
  const readMinutes = Math.max(
    1,
    Math.round(chapters.reduce((n, ch) => n + ch.body.length, 0) / 450),
  );
  const turn = (to: number) => {
    setPage(to);
    scroller.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[var(--ink-950)]">
      {scenario?.meta.coverImageKey && (
        // biome-ignore lint/performance/noImgElement: 정적 SVG 표지
        <img
          src={asset(scenario.meta.coverImageKey)}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_45%,transparent,var(--ink-950))]" />
      <div className="relative">
        <TopBar
          eyebrow={phase?.titleCard || "PROLOGUE"}
          title={`${phase?.title ?? "오프닝"} · ${state.scenarioTitle}`}
          right={
            <>
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                준비 {done}/{players.length}
              </span>
              <Countdown endsAt={state.phaseEndsAt} />
            </>
          }
        />
      </div>
      <main
        ref={scroller}
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-10"
      >
        <div
          key={page}
          className="m-auto w-full max-w-2xl animate-[nm-fade-up_640ms_var(--ease-quiet)]"
        >
          {page === 0 ? (
            <div className="text-center">
              <Eyebrow tone="var(--primary)">
                CASE {scenario?.meta.caseNumber} · {scenario?.meta.setting?.year}{" "}
                {scenario?.meta.setting?.place}
              </Eyebrow>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-tight md:text-5xl">
                {state.scenarioTitle}
              </h1>
              <p className="mt-5 font-serif text-lg leading-relaxed text-[var(--paper-300)]">
                {scenario?.meta.synopsis}
              </p>
              {chapters.length > 0 && (
                <p className="mt-8 font-mono text-xs tracking-[0.12em] text-muted-foreground">
                  PROLOGUE {chapters.length}장 · 약 {readMinutes}분
                </p>
              )}
            </div>
          ) : (
            chapter && (
              <article className="mx-auto max-w-[62ch]">
                <Eyebrow tone="var(--primary)">
                  PROLOGUE {chapter.title} · {page} / {chapters.length}
                </Eyebrow>
                <div className="mt-6 flex flex-col gap-5 font-serif text-[17px] leading-[1.9] text-[var(--paper-100)] [text-wrap:pretty] md:text-lg">
                  {chapter.body
                    .split(/\n\s*\n/)
                    .filter((t) => t.trim())
                    .map((text, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: 문단 순서는 바뀌지 않는다
                      <p key={i} className="whitespace-pre-line">
                        {text}
                      </p>
                    ))}
                </div>
              </article>
            )
          )}
        </div>
      </main>
      <div className="relative flex items-center justify-between gap-3 border-t border-border bg-[var(--ink-950)]/90 px-4 py-3 sm:px-8">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => turn(page - 1)}
          className={cn(btn.base, btn.ghost)}
        >
          <ChevronLeft size={16} /> 이전
        </button>
        <span className="font-mono text-xs text-muted-foreground">
          {page + 1} / {total}
        </span>
        {page < total - 1 ? (
          <button
            type="button"
            onClick={() => turn(page + 1)}
            className={cn(btn.base, btn.primary)}
          >
            기록 펼치기 <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => ctx.send("player:done", { done: !me?.done })}
            className={cn(btn.base, me?.done ? btn.secondary : btn.primary)}
          >
            <CircleCheck size={16} /> {me?.done ? "다른 참가자를 기다리는 중" : "다 읽었습니다"}
          </button>
        )}
      </div>
    </div>
  );
}

/** 인물 선택: 먼저 고른 사람이 맡고, 고르지 않은 사람은 남은 인물에 무작위 배정된다 */
export function CharacterSelect({ ctx }: { ctx: GameContext }) {
  const { scenario, state, me } = ctx;
  const [focus, setFocus] = useState<string>(me?.characterId || state.characters[0]?.id || "");
  const players = Object.values(state.players);
  const confirmed = players.filter((p) => p.done).length;
  const chosen = me?.characterId ? ctx.character(me.characterId) : undefined;
  const detail = scenario?.characters.find((c) => c.id === focus);
  const detailInfo = ctx.character(focus);
  const holderOf = (id: string) => players.find((p) => p.characterId === id);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        eyebrow={`CASTING · CASE ${scenario?.meta.caseNumber ?? ""}`}
        title={state.scenarioTitle}
        right={
          <>
            <span className="font-mono text-xs text-muted-foreground">
              확정 {confirmed}/{players.length}
            </span>
            <Countdown endsAt={state.phaseEndsAt} />
          </>
        }
      />
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        <main className="px-4 py-6 sm:px-10">
          <Eyebrow>CASTING · {state.characters.length} ROLES</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            당신은 누구입니까
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            맡고 싶은 인물을 고르십시오. 먼저 고른 사람이 그 인물을 맡고, 고르지 않은 참가자는 남은
            인물에 무작위로 배정됩니다.
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {state.characters.map((c, i) => {
              const holder = holderOf(c.id);
              const mine = me?.characterId === c.id;
              const pub = scenario?.characters.find((x) => x.id === c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setFocus(c.id)}
                    onDoubleClick={() =>
                      !holder && ctx.send("character:select", { characterId: c.id })
                    }
                    aria-pressed={focus === c.id}
                    className={cn(
                      "group flex w-full flex-col overflow-hidden rounded-[6px] border bg-card text-left shadow-[var(--shadow-paper)] transition-[transform,border-color] hover:-translate-y-0.5 hover:border-border-strong",
                      focus === c.id && "border-border-strong",
                      mine && "border-primary shadow-[var(--glow-candle)]",
                    )}
                  >
                    <div className="relative">
                      <Portrait
                        character={c}
                        className="aspect-[4/5] w-full"
                        dim={!!holder && !mine}
                      />
                      <span className="absolute left-2 top-2 rounded-[2px] bg-[var(--paper-100)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--ink-950)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <span className="font-mono text-[11px] font-bold tracking-[0.1em] text-primary">
                        {c.role}
                        {pub?.age ? ` · ${pub.age}세` : ""}
                      </span>
                      <span className="font-serif text-lg font-bold">{c.name}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {pub?.tagline || c.publicProfile}
                      </span>
                      <span className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs">
                        {holder ? (
                          <>
                            <CircleCheck size={13} className="text-[var(--alibi)]" />
                            {holder.nickname}
                            {mine && " (나)"}
                          </>
                        ) : (
                          <span className="text-muted-foreground">선택 가능</span>
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </main>
        <aside className="border-l border-border bg-[var(--ink-950)] p-5 lg:sticky lg:top-14 lg:h-[calc(100dvh-56px-89px)] lg:overflow-y-auto">
          {detail && detailInfo && (
            <div className="space-y-4">
              <Portrait
                character={detailInfo}
                className="mx-auto aspect-[4/5] w-full max-w-72 rounded-[6px] border border-border"
              />
              <div>
                <Eyebrow tone="var(--primary)">
                  {detail.role}
                  {detail.age ? ` · ${detail.age}세` : ""}
                </Eyebrow>
                <h2 className="mt-1 font-display text-3xl font-semibold">{detail.name}</h2>
                <p className="mt-3 font-serif leading-relaxed text-[var(--paper-200)]">
                  {detail.publicProfile}
                </p>
              </div>
              {detail.traits.length > 0 && (
                <dl className="border-t-[3px] border-double border-border-strong">
                  {detail.traits.map((t, i) => (
                    <div key={t} className="flex gap-4 border-b border-border py-2.5 text-sm">
                      <dt className="w-20 flex-none font-mono text-[11px] font-bold tracking-[0.12em] text-muted-foreground">
                        TRAIT {i + 1}
                      </dt>
                      <dd>{t}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <button
                type="button"
                disabled={!!holderOf(detail.id) || me?.done}
                onClick={() => ctx.send("character:select", { characterId: detail.id })}
                className={cn(btn.base, btn.primary, "w-full")}
              >
                {me?.characterId === detail.id
                  ? "내가 고른 인물"
                  : holderOf(detail.id)
                    ? "다른 참가자가 골랐어요"
                    : `${josa(detail.name.split(" ")[0] ?? detail.name, "으로/로")} 지망`}
              </button>
            </div>
          )}
        </aside>
      </div>
      <ActionBar
        eyebrow="MY CHOICE"
        title={chosen ? `${josa(chosen.name, "을/를")} 골랐어요` : "아직 고르지 않았어요"}
        desc={
          me?.done
            ? "확정했어요. 다른 참가자를 기다리는 중이에요."
            : "인물을 눌러 지망하세요. 확정 전에는 언제든 바꿀 수 있어요."
        }
      >
        {!me?.done && (
          <button
            type="button"
            onClick={() => {
              ctx.send("character:select", { characterId: "" });
              ctx.send("player:done", { done: true });
            }}
            className={cn(btn.base, btn.ghost)}
          >
            <Shuffle size={16} /> 아무나 괜찮아요
          </button>
        )}
        <button
          type="button"
          disabled={!me?.characterId && !me?.done}
          onClick={() => ctx.send("player:done", { done: !me?.done })}
          className={cn(btn.base, me?.done ? btn.secondary : btn.primary)}
        >
          {me?.done ? "확정 취소" : "지망 확정"}
        </button>
        {chosen && <Avatar character={chosen} size={40} className="hidden sm:inline-grid" />}
      </ActionBar>
    </div>
  );
}
