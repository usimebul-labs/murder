"use client";

import { cn } from "@mm/ui";
import { BookOpenCheck, CircleCheck, Lock, Target } from "lucide-react";
import { useState } from "react";
import { ActionBar, Avatar, btn, Countdown, Eyebrow, Notes, Portrait, TopBar } from "../primitives";
import type { GameContext } from "../types";

const SECTIONS = [
  ["identity", "01", "인물"],
  ["people", "02", "관계"],
  ["night", "03", "그날 밤"],
  ["truth", "04", "진실"],
  ["goals", "05", "목표"],
] as const;
type Section = (typeof SECTIONS)[number][0];

/** 비밀 문서 본문. 읽기 페이즈 화면과 게임 중 '비밀 문서' 창에서 같이 쓴다 */
export function DossierBody({ ctx, section }: { ctx: GameContext; section?: Section }) {
  const { script, scenario } = ctx;
  if (!script) {
    return <p className="text-muted-foreground">비밀 문서를 받는 중입니다…</p>;
  }
  const me = ctx.character(script.characterId);
  const pub = scenario?.characters.find((c) => c.id === script.characterId);
  const s = script.script;
  const show = (id: Section) => !section || section === id;
  return (
    <div className="space-y-10">
      {show("identity") && (
        <section id="dossier-identity" className="space-y-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <Portrait
              character={me}
              className="aspect-[4/5] w-36 flex-none rounded-[4px] border border-border"
            />
            <div>
              <Eyebrow>01 · WHO YOU ARE</Eyebrow>
              <h2 className="mt-2 font-display text-4xl font-semibold md:text-5xl">{me?.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {me?.role}
                {pub?.age ? ` · ${pub.age}세` : ""}
              </p>
            </div>
          </div>
          {script.isCulprit && (
            <p className="flex items-center gap-2 rounded-[4px] border border-[var(--accused-border)] bg-[var(--accused-surface)] px-3 py-2 text-sm font-semibold text-[var(--destructive-text)]">
              <Lock size={14} aria-hidden /> 당신이 범인입니다. 당신만 거짓말을 할 수 있습니다.
            </p>
          )}
          <Story text={s.identity} />
        </section>
      )}
      {show("people") && s.relationships.length > 0 && (
        <section id="dossier-people" className="space-y-4">
          <Eyebrow>02 · PEOPLE YOU KNOW</Eyebrow>
          <ul className="grid gap-3 sm:grid-cols-2">
            {s.relationships.map((r) => {
              const c = ctx.character(r.characterId);
              return (
                <li
                  key={r.characterId}
                  className="flex gap-3 rounded-[6px] border border-border bg-card p-3"
                >
                  <Avatar character={c} size={44} />
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: `var(--char-${c?.colorIndex})` }}
                    >
                      {c?.name}{" "}
                      <span className="text-xs font-normal text-muted-foreground">{c?.role}</span>
                    </p>
                    <p className="mt-1 font-serif text-[15px] leading-relaxed">{r.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {show("night") && s.timeline.length > 0 && (
        <section id="dossier-night" className="space-y-4">
          <Eyebrow>03 · THAT NIGHT</Eyebrow>
          <ol className="relative space-y-3 border-l border-border-strong pl-5">
            {s.timeline.map((t) => (
              <li key={`${t.time}-${t.text}`} className="relative">
                <span
                  className={cn(
                    "absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--ink-900)]",
                    t.secret ? "bg-[var(--secret)]" : "bg-primary",
                  )}
                />
                <p className="font-mono text-sm font-bold">
                  {t.time}
                  {t.secret && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-[2px] bg-[var(--secret-surface)] px-1.5 py-0.5 font-sans text-[11px] text-[var(--secret)]">
                      <Lock size={10} /> 비밀
                    </span>
                  )}
                </p>
                <p className="mt-1 font-serif text-[16px] leading-relaxed">{t.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {show("truth") && (
        <section id="dossier-truth" className="space-y-4">
          <Eyebrow tone="var(--secret)">04 · SEALED TRUTH</Eyebrow>
          <div className="rounded-[6px] border border-[var(--secret-border)] bg-[var(--secret-surface)] p-5">
            <Story text={s.sealedTruth.text} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.sealedTruth.mustHide.length > 0 && (
              <div className="rounded-[6px] border border-border bg-card p-4">
                <p className="mb-2 text-sm font-semibold text-[var(--destructive-text)]">
                  반드시 숨길 것
                </p>
                <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed">
                  {s.sealedTruth.mustHide.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {s.sealedTruth.mayReveal.length > 0 && (
              <div className="rounded-[6px] border border-border bg-card p-4">
                <p className="mb-2 text-sm font-semibold text-[var(--alibi)]">밝혀도 되는 것</p>
                <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed">
                  {s.sealedTruth.mayReveal.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
      {show("goals") && (
        <section id="dossier-goals" className="space-y-4">
          <Eyebrow tone="var(--primary)">05 · OBJECTIVES</Eyebrow>
          <ul className="space-y-2">
            {script.objectives.map((o) => (
              <li
                key={o.id}
                className="flex items-start gap-3 rounded-[6px] border border-[var(--paper-rule)] bg-[var(--paper-surface)] p-4 text-[var(--paper-ink)]"
              >
                <Target size={18} className="mt-0.5 flex-none" aria-hidden />
                <div className="flex-1">
                  <p className="font-mono text-[11px] font-bold tracking-[0.12em] text-[var(--paper-ink-muted)]">
                    {o.kind === "main" ? "주 목표" : "보조 목표"} · {o.points}점
                    {o.judge === "jury" && " · 참가자 판정"}
                  </p>
                  <p className="mt-1 font-serif text-[17px] font-bold leading-snug">{o.text}</p>
                </div>
              </li>
            ))}
            {!script.isCulprit && (
              <li className="rounded-[6px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                진범에게 투표하면 1점을 더 받습니다.
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function Story({ text }: { text: string }) {
  return (
    <div className="space-y-4 font-serif text-[17px] leading-[1.9] text-[var(--paper-100)]">
      {text.split(/\n{2,}/).map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

/** 비밀 문서 숙지 페이즈 */
export function Reading({ ctx }: { ctx: GameContext }) {
  const { state, me, phase, script } = ctx;
  const [section, setSection] = useState<Section>("identity");
  const [seen, setSeen] = useState<Set<Section>>(() => new Set(["identity"]));
  const players = Object.values(state.players).filter((p) => p.characterId);
  const done = players.filter((p) => p.done).length;
  const myInfo = ctx.character(ctx.myCharacterId);
  const go = (id: Section) => {
    setSection(id);
    setSeen((prev) => new Set(prev).add(id));
  };
  const unread = SECTIONS.filter(([id]) => !seen.has(id)).map(([, , label]) => label);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        eyebrow={phase?.titleCard || "SECRET DOSSIER"}
        title={state.scenarioTitle}
        right={
          <>
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
              준비 {done}/{players.length}
            </span>
            <Countdown endsAt={state.phaseEndsAt} />
          </>
        }
      />
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <nav
          className="border-b border-border p-4 lg:border-b-0 lg:border-r"
          aria-label="문서 목차"
        >
          <div className="mb-4 hidden items-center gap-3 lg:flex">
            <Avatar character={myInfo} size={44} />
            <div>
              <Eyebrow>YOUR ROLE</Eyebrow>
              <p className="font-serif font-bold">{myInfo?.name}</p>
              <p className="text-xs text-muted-foreground">{myInfo?.role}</p>
            </div>
          </div>
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map(([id, no, label]) => (
              <li key={id} className="flex-none">
                <button
                  type="button"
                  onClick={() => go(id)}
                  aria-current={section === id}
                  className={cn(
                    "flex h-11 w-full items-center gap-3 rounded-[4px] px-3 text-sm",
                    section === id
                      ? "bg-accent font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="font-mono text-[11px]">{no}</span>
                  <span className="flex-1 text-left">{label}</span>
                  {id === "truth" ? (
                    <Lock size={14} aria-hidden />
                  ) : seen.has(id) ? (
                    <CircleCheck size={14} className="text-[var(--alibi)]" aria-label="읽음" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 hidden text-xs leading-relaxed text-muted-foreground lg:block">
            이 문서는 당신에게만 보여요. 게임 중에도 상단의 비밀 문서 버튼으로 다시 열 수 있어요.
          </p>
          <div className="mt-6 hidden lg:block">
            <Eyebrow className="mb-2">
              PLAYERS · 준비 {done}/{players.length}
            </Eyebrow>
            <ul className="space-y-2">
              {players.map((p) => {
                const c = ctx.character(p.characterId);
                return (
                  <li key={p.characterId} className="flex items-center gap-2 text-sm">
                    <Avatar character={c} size={28} />
                    <span className="flex-1 truncate">{c?.name}</span>
                    {p.done ? (
                      <CircleCheck
                        size={14}
                        className="text-[var(--alibi)]"
                        aria-label="숙지 완료"
                      />
                    ) : (
                      <BookOpenCheck
                        size={14}
                        className="text-muted-foreground"
                        aria-label="읽는 중"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
        <main className="px-4 py-6 sm:px-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <Eyebrow>
              CASE FILE · DOSSIER · {script ? ctx.character(script.characterId)?.name : ""}
            </Eyebrow>
            <span className="inline-flex items-center gap-1 rounded-[2px] border border-border-strong px-2 py-1 font-mono text-[11px] text-muted-foreground">
              <Lock size={11} /> 본인 외 열람 금지
            </span>
          </div>
          <DossierBody ctx={ctx} section={section} />
        </main>
        <aside className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <Notes
            storageKey={`mm:note:${ctx.roomId}:${ctx.myCharacterId}`}
            className="lg:sticky lg:top-[72px] lg:h-[calc(100dvh-180px)]"
          />
        </aside>
      </div>
      <ActionBar
        eyebrow={`READING · ${seen.size}/${SECTIONS.length}`}
        title={myInfo ? `당신은 ${myInfo.name}입니다` : "비밀 문서"}
        desc={
          unread.length > 0 ? `아직 읽지 않은 항목 — ${unread.join(", ")}` : "모든 항목을 읽었어요"
        }
      >
        <button
          type="button"
          onClick={() => ctx.send("player:done", { done: !me?.done })}
          className={cn(btn.base, me?.done ? btn.secondary : btn.primary)}
        >
          <CircleCheck size={16} /> {me?.done ? "숙지 취소" : "숙지 완료"}
        </button>
      </ActionBar>
    </div>
  );
}
