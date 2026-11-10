"use client";

import { cn } from "@mm/ui";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Copy,
  Crown,
  Hourglass,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { ChatPanel } from "../chat";
import { Avatar, asset, btn, Eyebrow, TopBar } from "../primitives";
import type { GameContext } from "../types";

const PHASE_FLOW_LABEL: Record<string, string> = {
  intro: "프롤로그",
  "character-select": "인물 선택",
  reading: "비밀 문서",
  investigation: "탐색",
  discussion: "토론",
  "final-statements": "최후 진술",
  vote: "투표",
  "objectives-review": "목표 결산",
  ending: "결말",
};

export function Lobby({ ctx, onCopyLink }: { ctx: GameContext; onCopyLink: () => void }) {
  const { state, scenario, me } = ctx;
  const players = Object.entries(state.players);
  const max = scenario?.meta.maxPlayers ?? state.characters.length;
  const readyCount = players.filter(([, p]) => p.ready).length;
  const enough = state.preview || players.length >= state.minPlayers;
  const allReady = players.length > 0 && readyCount === players.length;
  const slots = Array.from({ length: Math.max(max, players.length) }, (_, i) => players[i]);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        eyebrow={`WAITING ROOM · CASE ${scenario?.meta.caseNumber ?? "00"}`}
        title={state.scenarioTitle}
        right={
          <button type="button" onClick={onCopyLink} className={cn(btn.base, btn.outline, btn.sm)}>
            <Copy size={14} aria-hidden /> 초대 링크
          </button>
        }
      />
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex min-h-0 flex-col">
          <section className="space-y-4 border-b border-border px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {scenario?.meta.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-[2px] border border-border-strong px-2 py-0.5 text-xs font-semibold"
                >
                  {t}
                </span>
              ))}
              {state.preview && (
                <span className="rounded-[2px] border border-[var(--secret-border)] bg-[var(--secret-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--secret)]">
                  테스트 방 · 인원 제한 없음
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <Eyebrow className="mb-2">
                  참가자 {players.length}/{max}
                </Eyebrow>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {slots.map((entry, i) =>
                    entry ? (
                      <li
                        key={entry[0]}
                        className={cn(
                          "flex h-14 items-center gap-2.5 rounded-[6px] border bg-card px-3",
                          entry[0] === ctx.sessionId
                            ? "border-[var(--brass-700)]"
                            : "border-border",
                          !entry[1].connected && "opacity-50",
                        )}
                      >
                        <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--ink-700)] text-muted-foreground">
                          <UserRound size={18} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {entry[1].nickname}
                          {entry[0] === ctx.sessionId && (
                            <span className="ml-1 text-xs text-muted-foreground">나</span>
                          )}
                        </span>
                        {entry[1].isHost ? (
                          <Badge tone="var(--primary)" icon={<Crown size={12} />}>
                            HOST
                          </Badge>
                        ) : null}
                        {entry[1].ready ? (
                          <Badge tone="var(--alibi)" icon={<CircleCheck size={12} />}>
                            READY
                          </Badge>
                        ) : (
                          !entry[1].isHost && (
                            <Badge tone="var(--muted-foreground)" icon={<Hourglass size={12} />}>
                              WAIT
                            </Badge>
                          )
                        )}
                      </li>
                    ) : (
                      <li
                        // biome-ignore lint/suspicious/noArrayIndexKey: 빈 자리는 순서로만 구분된다
                        key={`empty-${i}`}
                        className="flex h-14 items-center gap-2.5 rounded-[6px] border border-dashed border-border px-3 text-sm text-muted-foreground"
                      >
                        <span className="h-8 w-8 rounded-full border border-dashed border-border-strong" />
                        빈 자리
                      </li>
                    ),
                  )}
                </ul>
              </div>
              <div className="flex flex-col justify-end gap-3">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">준비 현황</span>
                    <span className="font-display text-2xl">
                      {readyCount}
                      <span className="text-base text-muted-foreground"> / {players.length}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {players.map(([id, p]) => (
                      <span
                        key={id}
                        className="h-1 flex-1 rounded-full"
                        style={{ background: p.ready ? "var(--alibi)" : "var(--ink-600)" }}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {!enough
                      ? `${state.minPlayers}명이 모여야 시작할 수 있어요`
                      : allReady
                        ? "모두 준비됐어요"
                        : "준비가 되면 버튼을 눌러 주세요"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => ctx.send("player:ready", { ready: !me?.ready })}
                  className={cn(btn.base, me?.ready ? btn.secondary : btn.primary, "w-full")}
                >
                  <CircleCheck size={16} aria-hidden />
                  {me?.ready ? "준비 취소" : "준비 완료"}
                </button>
                {me?.isHost && (
                  <button
                    type="button"
                    disabled={!enough || !allReady}
                    onClick={() => ctx.send("phase:advance", {})}
                    className={cn(btn.base, btn.outline, "w-full")}
                  >
                    사건 시작
                  </button>
                )}
              </div>
            </div>
          </section>
          <ChatPanel
            ctx={ctx}
            className="min-h-80 flex-1"
            placeholder="대기실에 인사를 남겨 보세요"
          />
        </div>
        <CaseFile ctx={ctx} />
      </div>
    </div>
  );
}

function Badge({
  tone,
  icon,
  children,
}: {
  tone: string;
  icon: React.ReactNode;
  children: string;
}) {
  return (
    <span
      className="inline-flex flex-none items-center gap-1 font-mono text-[10px] font-bold tracking-[0.1em]"
      style={{ color: tone }}
    >
      {icon}
      {children}
    </span>
  );
}

/** 오른쪽 사건 자료: 프롤로그 / 진행 방식 / 등장인물 */
export function CaseFile({ ctx, className }: { ctx: GameContext; className?: string }) {
  const { scenario, state } = ctx;
  const [tab, setTab] = useState<"prologue" | "rules" | "cast">("prologue");
  const [page, setPage] = useState(0);
  if (!scenario) return null;
  const chapters = scenario.prologue;
  const chapter = chapters[page];
  return (
    <aside
      className={cn("flex min-h-0 flex-col border-l border-border bg-[var(--ink-950)]", className)}
    >
      {scenario.meta.coverImageKey && (
        <div className="relative aspect-[16/7] flex-none overflow-hidden border-b border-border">
          {/* biome-ignore lint/performance/noImgElement: 정적 SVG 표지 */}
          <img
            src={asset(scenario.meta.coverImageKey)}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink-950)] via-transparent" />
          <div className="absolute inset-x-4 bottom-3">
            <Eyebrow tone="var(--primary)">CASE FILE · {scenario.meta.caseNumber}</Eyebrow>
            <p className="font-serif text-sm text-[var(--paper-200)]">{scenario.meta.hook}</p>
          </div>
        </div>
      )}
      <div className="flex flex-none border-b border-border" role="tablist">
        {(
          [
            ["prologue", "프롤로그"],
            ["rules", "진행 방식"],
            ["cast", "등장인물"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "relative h-12 flex-1 text-sm font-semibold text-muted-foreground hover:text-foreground",
              tab === id &&
                "text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-primary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "prologue" && chapter && (
          <article className="rounded-[6px] border border-[var(--paper-rule)] bg-[var(--paper-surface)] p-5 text-[var(--paper-ink)] shadow-[var(--shadow-raised)]">
            <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[var(--paper-ink-muted)]">
              PROLOGUE {chapter.title} · {scenario.meta.setting?.year ?? ""}{" "}
              {scenario.meta.setting?.place ?? ""}
            </p>
            {/* 본문만 따로 스크롤해 이전·다음 버튼이 늘 보이게 한다 */}
            <p
              key={page}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: 키보드로 본문을 스크롤할 수 있어야 한다
              tabIndex={0}
              className="mt-4 max-h-[clamp(200px,40vh,360px)] overflow-y-auto overscroll-contain whitespace-pre-wrap pr-2 font-serif text-[17px] leading-[1.85] [scrollbar-color:var(--paper-rule)_transparent] [scrollbar-width:thin]"
            >
              {chapter.body}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-[var(--paper-rule)] pt-3 text-sm">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex h-9 items-center gap-1 rounded px-2 disabled:opacity-40"
              >
                <ChevronLeft size={16} /> 이전
              </button>
              <span className="font-mono text-xs">
                {page + 1} / {chapters.length}
              </span>
              <button
                type="button"
                disabled={page >= chapters.length - 1}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-9 items-center gap-1 rounded px-2 font-semibold disabled:opacity-40"
              >
                다음 <ChevronRight size={16} />
              </button>
            </div>
          </article>
        )}
        {tab === "rules" && (
          <div className="space-y-5">
            <ol className="space-y-3">
              {scenario.rules.map((r, i) => (
                <li key={r} className="flex gap-3 text-sm leading-relaxed">
                  <span className="font-mono text-xs font-bold text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {r}
                </li>
              ))}
            </ol>
            <div>
              <Eyebrow className="mb-2">진행 순서 · 약 {scenario.meta.estimatedMinutes}분</Eyebrow>
              <ol className="space-y-1.5">
                {state.phases.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1">{p.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {PHASE_FLOW_LABEL[p.kind]} · {Math.round(p.durationSec / 60)}분
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
        {tab === "cast" && (
          <ul className="space-y-3">
            {scenario.victim && (
              <li className="flex gap-3 rounded-[6px] border border-[var(--victim-border)] bg-[var(--victim-surface)] p-3">
                <Avatar
                  character={{
                    id: "victim",
                    name: scenario.victim.name,
                    role: "피해자",
                    publicProfile: "",
                    portraitKey: scenario.victim.portraitKey ?? "",
                    colorIndex: 0,
                  }}
                  ring="var(--victim)"
                  size={48}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {scenario.victim.name}{" "}
                    <span className="text-xs text-[var(--victim)]">피해자</span>
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {scenario.victim.description}
                  </p>
                </div>
              </li>
            )}
            {scenario.characters.map((c) => {
              const info = ctx.character(c.id);
              return (
                <li
                  key={c.id}
                  className="flex gap-3 rounded-[6px] border border-border bg-card p-3"
                >
                  <Avatar character={info} size={48} />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span
                        className="font-semibold"
                        style={{ color: `var(--char-${c.colorIndex})` }}
                      >
                        {c.name}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {c.role}
                        {c.age ? ` · ${c.age}세` : ""}
                      </span>
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {c.publicProfile}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
