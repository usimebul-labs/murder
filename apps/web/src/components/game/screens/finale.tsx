"use client";

import type { GameResult } from "@mm/game-protocol";
import { cn } from "@mm/ui";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleX,
  Gavel,
  Hourglass,
  Info,
  MapPin,
  Target,
  Trophy,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { josa } from "@/lib/josa";
import {
  ActionBar,
  Avatar,
  btn,
  ClueCard,
  Countdown,
  Eyebrow,
  Portrait,
  phaseTone,
  TopBar,
} from "../primitives";
import { HeaderTools } from "../tools";
import type { GameContext } from "../types";

function useResult(ctx: GameContext): GameResult | null {
  return useMemo(() => {
    if (!ctx.state.result) return null;
    try {
      return JSON.parse(ctx.state.result) as GameResult;
    } catch {
      return null;
    }
  }, [ctx.state.result]);
}

/* ───────────── 최종 투표 ───────────── */

export function FinalVote({ ctx }: { ctx: GameContext }) {
  const { state, phase, me, myCharacterId } = ctx;
  const [choice, setChoice] = useState<string | null>(null);
  const tone = phaseTone("vote");
  const runoff = state.runoffCandidates.length > 0;
  const candidates = runoff
    ? state.characters.filter((c) => state.runoffCandidates.includes(c.id))
    : state.characters;
  const voters = Object.values(state.players).filter((p) => p.characterId);
  const voted = voters.filter((p) => p.hasVoted).length;
  const canVote = !!myCharacterId && !me?.hasVoted && !state.accusedCharacterId;
  const chosen = choice ? ctx.character(choice) : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        eyebrow={`${phase?.titleCard || "FINAL VOTE"} · 범인 지목`}
        title={`${phase?.title ?? "최종 투표"} · ${state.scenarioTitle}`}
        tone={tone}
        right={
          <>
            <Countdown endsAt={state.phaseEndsAt} tone={tone} label="투표" />
            <HeaderTools ctx={ctx} />
          </>
        }
      />
      <ul className="flex flex-none gap-2 overflow-x-auto border-b border-border bg-card px-4 py-3 sm:px-6">
        {voters.map((p) => {
          const c = ctx.character(p.characterId);
          return (
            <li
              key={p.characterId}
              className="flex min-w-40 flex-1 items-center gap-2.5 rounded-[6px] border border-border px-3 py-2"
            >
              <Avatar character={c} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c?.name}</p>
                <p
                  className={cn(
                    "text-[11px]",
                    p.hasVoted ? "text-[var(--alibi)]" : "text-muted-foreground",
                  )}
                >
                  {p.hasVoted ? "확정" : "고르는 중"}
                </p>
              </div>
              {p.hasVoted ? (
                <CircleCheck size={15} className="text-[var(--alibi)]" aria-label="확정" />
              ) : (
                <Hourglass size={15} className="text-muted-foreground" aria-label="고르는 중" />
              )}
            </li>
          );
        })}
      </ul>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="text-center">
          <Eyebrow tone={tone}>
            BALLOT · {state.voteRound}차 투표{runoff && " · 결선"}
          </Eyebrow>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
            범인을 지목하십시오
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {runoff
              ? "동표가 나왔습니다. 결선 후보 중 한 명을 다시 고르십시오."
              : "범인이라 생각하는 사람을 한 명 고르십시오. 자기 자신도 지목할 수 있습니다."}{" "}
            개표 전까지 누가 누구를 지목했는지는 공개되지 않습니다.
          </p>
        </div>
        {state.accusedCharacterId ? (
          <div className="mt-12 text-center">
            <p className="inline-block animate-[nm-stamp_640ms_var(--ease-stamp)_both] rounded-[4px] border-[3px] border-[var(--oxblood-400)] px-6 py-3 font-display text-3xl tracking-[0.14em] text-[var(--destructive-text)]">
              개표 중
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {candidates.map((c) => {
              const selected = choice === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={!canVote}
                    onClick={() => setChoice(c.id)}
                    aria-pressed={selected}
                    className={cn(
                      "relative flex w-full flex-col items-center gap-2 rounded-[6px] border bg-card px-4 pb-4 pt-6 text-center transition-[transform,border-color,box-shadow]",
                      canVote && "hover:-translate-y-0.5 hover:border-border-strong",
                      selected &&
                        "border-[var(--accused-border)] bg-[var(--accused-surface)] shadow-[var(--glow-accused)]",
                    )}
                  >
                    {c.id === myCharacterId && (
                      <span className="absolute left-2 top-2 rounded-[2px] border border-border-strong px-1.5 font-mono text-[10px]">
                        나
                      </span>
                    )}
                    <Avatar
                      character={c}
                      size={84}
                      ring={selected ? "var(--accused)" : undefined}
                    />
                    <span className="font-serif text-lg font-bold">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.role}</span>
                    <span
                      className={cn(
                        "mt-2 inline-flex w-full items-center justify-center gap-1.5 border-t border-border pt-3 text-xs font-semibold",
                        selected ? "text-[var(--destructive-text)]" : "text-muted-foreground",
                      )}
                    >
                      {selected ? <Target size={14} /> : <Circle size={14} />}
                      {selected ? "지목" : "선택하기"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <ActionBar
        eyebrow={`YOUR ACCUSATION · ${voted}/${voters.length} 확정`}
        title={
          me?.hasVoted
            ? "지목을 확정했습니다. 개표를 기다리십시오."
            : chosen
              ? `${josa(chosen.name, "을/를")} 범인으로 지목합니다`
              : myCharacterId
                ? "후보를 한 명 고르십시오. 시간 안에 확정하지 않으면 기권으로 처리됩니다."
                : "관전 중입니다"
        }
        desc="한 번 확정하면 바꿀 수 없습니다."
        tone={tone}
      >
        {canVote && (
          <button
            type="button"
            disabled={!choice}
            onClick={() => choice && ctx.send("vote:cast", { suspectCharacterId: choice })}
            className={cn(btn.base, btn.accuse, btn.lg)}
          >
            <Target size={18} /> 지목 확정
          </button>
        )}
        {me?.isHost && !state.accusedCharacterId && (
          <button
            type="button"
            onClick={() =>
              window.confirm("지금까지 모인 표로 개표할까요?") && ctx.send("phase:advance", {})
            }
            className={cn(btn.base, btn.outline, btn.sm)}
          >
            <Vote size={14} /> 바로 개표
          </button>
        )}
      </ActionBar>
    </div>
  );
}

/* ───────────── 목표 결산 ───────────── */

export function Objectives({ ctx }: { ctx: GameContext }) {
  const { state, phase, myCharacterId } = ctx;
  const result = useResult(ctx);
  const tone = phaseTone("objectives-review");
  const scores = result?.scores ?? [];
  const [focus, setFocus] = useState<string>(scores[0]?.characterId ?? "");
  const current = scores.find((s) => s.characterId === focus) ?? scores[0];
  const c = current ? ctx.character(current.characterId) : undefined;
  const possible = scores.reduce((sum, s) => sum + s.objectives.length, 0);
  const achieved = scores.reduce(
    (sum, s) => sum + s.objectives.filter((o) => o.achieved).length,
    0,
  );
  const pendingJury = Object.values(state.jury).filter(
    (j) => j.characterId !== myCharacterId && myCharacterId && !j.voters.includes(myCharacterId),
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        eyebrow={`${phase?.titleCard || "OBJECTIVES"} · 개인 목표 채점`}
        title={`${phase?.title ?? "목표 결산"} · ${state.scenarioTitle}`}
        tone={tone}
        right={
          <>
            <span
              className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 font-mono text-xs font-bold"
              style={{ color: tone, borderColor: tone }}
            >
              <Trophy size={14} /> {achieved} / {possible} 달성
            </span>
            <Countdown endsAt={state.phaseEndsAt} tone={tone} />
          </>
        }
      />
      <div
        className="flex flex-none gap-2 overflow-x-auto border-b border-border bg-card px-4 py-3 sm:px-6"
        role="tablist"
      >
        {scores.map((s, i) => {
          const ch = ctx.character(s.characterId);
          const active = current?.characterId === s.characterId;
          return (
            <div key={s.characterId} className="flex min-w-44 flex-1">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFocus(s.characterId)}
                className={cn(
                  "flex w-full animate-[nm-fade-up_420ms_var(--ease-quiet)_both] items-center gap-2.5 rounded-[6px] border px-3 py-2 text-left",
                  active
                    ? "border-[var(--phase-ending)] bg-[var(--phase-ending-surface)]"
                    : "border-border",
                )}
                style={{ animationDelay: `${i * 300}ms` }}
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar character={ch} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {ch?.name}
                    {s.characterId === myCharacterId && " (나)"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {s.objectives.some((o) => o.achieved === null) ? "판정 중" : `${s.total}점`}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {current && c && (
          <section
            key={current.characterId}
            className="animate-[nm-fade-up_420ms_var(--ease-quiet)]"
          >
            <div className="flex items-center gap-5">
              <Avatar character={c} size={84} ring={tone} />
              <div className="min-w-0 flex-1">
                <Eyebrow tone={tone}>
                  GRADING · {String(scores.indexOf(current) + 1).padStart(2, "0")} /{" "}
                  {String(scores.length).padStart(2, "0")}
                </Eyebrow>
                <h2 className="font-display text-3xl font-semibold md:text-4xl">{c.name}</h2>
                <p className="text-sm text-muted-foreground">{c.role}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-4xl">{current.total}</p>
                <p className="font-mono text-[11px] text-muted-foreground">점</p>
              </div>
            </div>
            <ul className="mt-6 overflow-hidden rounded-[6px] border border-[var(--paper-rule)] bg-[var(--paper-surface)] text-[var(--paper-ink)]">
              {current.objectives.map((o, i) => (
                <li
                  key={o.id}
                  className="flex animate-[nm-fade-up_420ms_var(--ease-quiet)_both] items-start gap-3 border-b border-dashed border-[var(--paper-rule)] px-5 py-4 last:border-b-0"
                  style={{ animationDelay: `${300 + i * 600}ms` }}
                >
                  <span className="mt-0.5">
                    {o.achieved === null ? (
                      <Hourglass
                        size={18}
                        className="text-[var(--paper-ink-muted)]"
                        aria-label="판정 중"
                      />
                    ) : o.achieved ? (
                      <CircleCheck
                        size={18}
                        className="text-[oklch(0.45_0.07_160)]"
                        aria-label="달성"
                      />
                    ) : (
                      <CircleX
                        size={18}
                        className="text-[oklch(0.46_0.15_25)]"
                        aria-label="미달성"
                      />
                    )}
                  </span>
                  <div className="flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--paper-ink-muted)]">
                      {o.kind === "main" ? "주 목표" : "보조 목표"} · {o.points}점
                      <span className="rounded-[2px] border border-[var(--paper-rule)] px-1 font-sans tracking-normal">
                        {o.judge === "auto" ? "자동 판정" : "참가자 판정"}
                      </span>
                    </p>
                    <p className="mt-1 font-serif text-[17px] font-bold leading-snug">{o.text}</p>
                    {o.judge !== "auto" && (
                      <p className="mt-1 text-xs text-[var(--paper-ink-muted)]">
                        판정 {(o.juryYes ?? 0) + (o.juryNo ?? 0)}표 · 달성 {o.juryYes ?? 0} · 미달성{" "}
                        {o.juryNo ?? 0}
                      </p>
                    )}
                  </div>
                  <span className="font-display text-xl">{o.achieved ? `+${o.points}` : "0"}</span>
                </li>
              ))}
              <li className="flex items-center gap-3 bg-[var(--paper-surface-2)] px-5 py-3 text-sm">
                <Gavel size={16} aria-hidden />
                <span className="flex-1">진범 지목</span>
                <span className="font-display text-xl">{current.culpritVote ? "+1" : "0"}</span>
              </li>
            </ul>
          </section>
        )}
        <aside className="space-y-4">
          <div className="rounded-[6px] border border-border bg-card p-5">
            <Eyebrow tone={tone}>RECORD CHECK · 자동 판정</Eyebrow>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              단서 보유·공개, 투표 기록과 대조해 자동으로 판정합니다. 참가자 판정 목표는 다른 참가자
              과반의 판단을 따릅니다.
            </p>
          </div>
          {pendingJury.map((j) => {
            const subject = ctx.character(j.characterId);
            const objective = scores
              .find((s) => s.characterId === j.characterId)
              ?.objectives.find((o) => o.id === j.objectiveId);
            return (
              <div
                key={`${j.characterId}:${j.objectiveId}`}
                className="rounded-[6px] border border-[var(--phase-ending)] bg-[var(--phase-ending-surface)] p-5"
              >
                <Eyebrow tone={tone}>JURY · 참가자 판정</Eyebrow>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
                  <Avatar character={subject} size={22} /> {subject?.name}의 목표
                </p>
                <p className="mt-2 font-serif text-lg font-bold leading-snug">{objective?.text}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  토론을 떠올려 보고, 이 목표를 이뤘는지 판정해 주세요.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      ctx.send("jury:vote", {
                        characterId: j.characterId,
                        objectiveId: j.objectiveId,
                        achieved: true,
                      })
                    }
                    className={cn(btn.base, btn.secondary)}
                  >
                    <CircleCheck size={16} /> 달성
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      ctx.send("jury:vote", {
                        characterId: j.characterId,
                        objectiveId: j.objectiveId,
                        achieved: false,
                      })
                    }
                    className={cn(btn.base, btn.secondary)}
                  >
                    <CircleX size={16} /> 미달성
                  </button>
                </div>
              </div>
            );
          })}
          <div className="rounded-[6px] border border-border bg-card p-5">
            <Eyebrow>SCOREBOARD</Eyebrow>
            <ol className="mt-3 space-y-2">
              {[...scores]
                .sort((a, b) => b.total - a.total)
                .map((s, i) => (
                  <li key={s.characterId} className="flex items-center gap-2.5 text-sm">
                    <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                    <Avatar character={ctx.character(s.characterId)} size={24} />
                    <span className="flex-1">{ctx.character(s.characterId)?.name}</span>
                    <span className="font-display text-lg">{s.total}</span>
                  </li>
                ))}
            </ol>
          </div>
        </aside>
      </main>
      <ActionBar eyebrow="OBJECTIVES" title="모든 목표를 판정하면 결말이 공개됩니다" tone={tone}>
        {ctx.me?.isHost && (
          <button
            type="button"
            onClick={() => ctx.send("phase:advance", {})}
            className={cn(btn.base, btn.primary)}
          >
            결말 공개 <ChevronRight size={16} />
          </button>
        )}
      </ActionBar>
    </div>
  );
}

/* ───────────── 결말 ───────────── */

const ENDING_TABS = ["서막", "진범", "그날 밤", "비밀", "에필로그", "사건 종결"] as const;

export function Ending({ ctx }: { ctx: GameContext }) {
  const { state, scenario } = ctx;
  const result = useResult(ctx);
  const [step, setStep] = useState(0);
  const tone = phaseTone("ending");
  if (!result) return null;
  const culprit = ctx.character(result.culpritId);
  const accused = result.accusedId ? ctx.character(result.accusedId) : undefined;
  const solved = result.accusedId === result.culpritId;
  const votesFor = (id: string) =>
    Object.entries(result.votes)
      .filter(([, v]) => v === id)
      .map(([k]) => k);
  const locationName = (id?: string) => scenario?.locations.find((l) => l.id === id)?.name;
  const clueCode = (id: string) => result.clues.find((c) => c.id === id)?.code ?? id;

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--ink-950)]">
      <TopBar
        eyebrow="ENDING · 결말"
        title={`결말과 에필로그 · ${state.scenarioTitle}`}
        tone={tone}
        right={
          <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-muted-foreground">
            CASE FILE · {scenario?.meta.caseNumber}
          </span>
        }
      />
      <div
        className="flex flex-none justify-center overflow-x-auto border-b border-border bg-background"
        role="tablist"
      >
        {ENDING_TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={step === i}
            onClick={() => setStep(i)}
            className={cn(
              "relative h-12 flex-none px-4 text-sm text-muted-foreground hover:text-foreground sm:px-8",
              step === i && "text-foreground",
            )}
          >
            <span className="mr-1.5 font-mono text-[10px]">{String(i + 1).padStart(2, "0")}</span>
            {t}
            {step === i && (
              <span className="absolute inset-x-2 -bottom-px h-0.5" style={{ background: tone }} />
            )}
          </button>
        ))}
      </div>
      <main
        key={step}
        className="flex flex-1 animate-[nm-fade_640ms] flex-col items-center px-4 py-10 sm:px-8"
      >
        {step === 0 && (
          <div className="my-auto max-w-2xl text-center">
            <Eyebrow tone={tone}>THE LAST CANDLE</Eyebrow>
            <h1 className="mt-4 font-display text-4xl font-semibold md:text-6xl">
              진실이 밝혀질 시간입니다
            </h1>
            <p className="mt-6 font-serif text-lg leading-relaxed text-muted-foreground">
              새벽, 서재에 모인 사람들 앞에서 마지막 촛불 하나가 사건 기록의 첫 장을 비춥니다.{" "}
              {accused
                ? `당신들은 ${josa(accused.name, "을/를")} 지목했습니다.`
                : "당신들은 아무도 지목하지 못했습니다."}
            </p>
          </div>
        )}
        {step === 1 && culprit && (
          <div className="my-auto flex w-full max-w-4xl flex-col items-center gap-8 md:flex-row md:items-center">
            <div className="relative animate-[nm-spot_2400ms_var(--ease-reveal)_both]">
              <Portrait
                character={culprit}
                className="aspect-[4/5] w-64 rounded-[6px] border border-[var(--revealed-border)] shadow-[var(--glow-spotlight)]"
              />
              <span className="absolute -right-4 bottom-6 animate-[nm-stamp_640ms_var(--ease-stamp)_1800ms_both] rounded-[4px] border-[3px] border-[var(--oxblood-400)] bg-[var(--ink-950)]/80 px-4 py-1 font-display text-2xl tracking-[0.14em] text-[var(--destructive-text)]">
                CULPRIT
              </span>
            </div>
            <div className="flex-1 text-center md:text-left">
              <Eyebrow tone={tone}>THE CULPRIT</Eyebrow>
              <h2 className="mt-2 font-display text-5xl font-semibold">{culprit.name}</h2>
              <p className="mt-1 text-muted-foreground">{culprit.role}</p>
              <p
                className={cn(
                  "mt-6 inline-flex items-center gap-2 rounded-[4px] border px-4 py-2 font-semibold",
                  solved
                    ? "border-[var(--alibi-border)] bg-[var(--alibi-surface)] text-[var(--alibi)]"
                    : "border-[var(--accused-border)] bg-[var(--accused-surface)] text-[var(--destructive-text)]",
                )}
              >
                {solved ? <CircleCheck size={18} /> : <CircleX size={18} />}
                {solved
                  ? "범인을 정확히 지목했습니다"
                  : accused
                    ? `${josa(accused.name, "을/를")} 지목했습니다 — 진범이 아닙니다`
                    : "아무도 지목하지 못했습니다"}
              </p>
              <ul className="mt-6 space-y-2">
                {state.characters
                  .filter((c) => votesFor(c.id).length > 0)
                  .sort((a, b) => votesFor(b.id).length - votesFor(a.id).length)
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-3 text-sm">
                      <Avatar character={c} size={26} />
                      <span className="w-28 truncate font-semibold">{c.name}</span>
                      <span className="font-display text-lg">{votesFor(c.id).length}표</span>
                      <span className="flex -space-x-1.5">
                        {votesFor(c.id).map((v) => (
                          <Avatar key={v} character={ctx.character(v)} size={20} />
                        ))}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}
        {step === 2 && result.solution && (
          <div className="w-full max-w-3xl space-y-8">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[6px] border border-border bg-card p-5">
                <Eyebrow tone={tone}>MOTIVE · 동기</Eyebrow>
                <p className="mt-2 font-serif leading-relaxed">{result.solution.motive}</p>
              </div>
              <div className="rounded-[6px] border border-border bg-card p-5">
                <Eyebrow tone={tone}>METHOD · 수법</Eyebrow>
                <p className="mt-2 font-serif leading-relaxed">{result.solution.method}</p>
              </div>
            </div>
            <div>
              <Eyebrow>03 · THAT NIGHT</Eyebrow>
              <ol className="relative mt-4 space-y-4 border-l border-border-strong pl-6">
                {result.solution.timeline.map((t) => (
                  <li key={`${t.time}-${t.text}`} className="relative">
                    <span
                      className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--ink-950)]"
                      style={{ background: tone }}
                    />
                    <p className="flex flex-wrap items-center gap-2 font-mono text-sm font-bold">
                      {t.time}
                      {t.locationId && (
                        <span className="inline-flex items-center gap-1 font-sans text-xs font-normal text-muted-foreground">
                          <MapPin size={12} /> {locationName(t.locationId)}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 font-serif leading-relaxed">{t.text}</p>
                    {t.clueIds.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {t.clueIds.map((id) => (
                          <span
                            key={id}
                            className="rounded-[2px] border border-[var(--clue-border)] bg-[var(--clue-surface)] px-1.5 font-mono text-[11px] text-primary"
                          >
                            {clueCode(id)}
                          </span>
                        ))}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
        {step === 3 && (
          <ul className="grid w-full max-w-5xl gap-4 md:grid-cols-2">
            {result.secrets
              .filter((s) => ctx.character(s.characterId))
              .map((s) => {
                const ch = ctx.character(s.characterId);
                return (
                  <li
                    key={s.characterId}
                    className="flex gap-4 rounded-[6px] border border-[var(--secret-border)] bg-[var(--secret-surface)] p-5"
                  >
                    <Avatar character={ch} size={52} />
                    <div>
                      <p className="font-semibold">
                        {ch?.name}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {ch?.role}
                        </span>
                      </p>
                      <p className="mt-2 font-serif leading-relaxed">{s.text}</p>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
        {step === 4 && (
          <div className="my-auto max-w-2xl text-center">
            <Eyebrow tone={tone}>EPILOGUE</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold md:text-5xl">
              {result.ending.title}
            </h2>
            <p className="mt-8 whitespace-pre-wrap text-left font-serif text-lg leading-[1.9] text-[var(--paper-100)]">
              {result.ending.body}
            </p>
          </div>
        )}
        {step === 5 && (
          <div className="w-full max-w-5xl space-y-8">
            <div className="text-center">
              <Eyebrow tone={tone}>CASE CLOSED</Eyebrow>
              <h2 className="mt-2 font-display text-4xl font-semibold">사건 종결</h2>
            </div>
            <ol className="mx-auto max-w-xl space-y-2">
              {[...result.scores]
                .sort((a, b) => b.total - a.total)
                .map((s, i) => {
                  const ch = ctx.character(s.characterId);
                  const player = ctx.playerOf(s.characterId);
                  return (
                    <li
                      key={s.characterId}
                      className={cn(
                        "flex items-center gap-3 rounded-[6px] border bg-card px-4 py-3",
                        i === 0 ? "border-primary shadow-[var(--glow-candle)]" : "border-border",
                      )}
                    >
                      <span className="w-6 font-display text-xl text-muted-foreground">
                        {i + 1}
                      </span>
                      <Avatar character={ch} size={36} />
                      <span className="flex-1">
                        <span className="block font-semibold">{ch?.name}</span>
                        <span className="text-xs text-muted-foreground">{player?.nickname}</span>
                      </span>
                      <span className="font-display text-2xl">{s.total}점</span>
                    </li>
                  );
                })}
            </ol>
            <div>
              <Eyebrow className="mb-3">ALL EVIDENCE · 핵심 단서는 촛불로 표시</Eyebrow>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {result.clues.map((c) => (
                  <li key={c.id}>
                    <ClueCard
                      clue={{ ...c, imageKey: c.imageKey ?? "" }}
                      compact
                      highlight={c.isKey}
                      className="h-full w-full"
                      holder={
                        c.holderIds.length ? (
                          <span className="inline-flex items-center gap-1">
                            {c.holderIds.map((h) => (
                              <Avatar key={h} character={ctx.character(h)} size={18} />
                            ))}
                          </span>
                        ) : (
                          <span className="text-[var(--paper-ink-muted)]">미수집</span>
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center gap-2 pb-6">
              <Link href="/" className={cn(btn.base, btn.primary)}>
                처음으로
              </Link>
            </div>
          </div>
        )}
      </main>
      <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-background px-4 py-3 sm:px-12">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className={cn(btn.base, btn.ghost)}
        >
          <ChevronLeft size={16} /> 이전
        </button>
        <span className="font-mono text-xs text-muted-foreground">
          {step + 1} / {ENDING_TABS.length}
        </span>
        {step < ENDING_TABS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className={cn(btn.base, btn.primary)}
          >
            기록 펼치기 <ChevronRight size={16} />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info size={14} /> 결말은 다시 넘겨 볼 수 있어요
          </span>
        )}
      </div>
    </div>
  );
}
