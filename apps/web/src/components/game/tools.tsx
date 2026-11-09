"use client";

import { cn } from "@mm/ui";
import { BookOpen, Lock, Map as MapIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { josa } from "@/lib/josa";
import { asset, btn, CATEGORY, ClueCard, Modal } from "./primitives";
import { DossierBody } from "./screens/dossier";
import { CaseFile } from "./screens/lobby";
import type { ClueCardInfo, ClueInfo, GameContext } from "./types";

/** 게임 중 헤더 오른쪽 도구: 비밀 문서, 사건 자료 */
export function HeaderTools({ ctx }: { ctx: GameContext }) {
  const [open, setOpen] = useState<"dossier" | "file" | null>(null);
  return (
    <>
      {ctx.script && (
        <button
          type="button"
          onClick={() => setOpen("dossier")}
          className={cn(btn.base, btn.ghost, btn.sm)}
          aria-label="비밀 문서"
        >
          <Lock size={15} aria-hidden /> <span className="hidden md:inline">비밀 문서</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen("file")}
        className={cn(btn.base, btn.ghost, btn.sm)}
        aria-label="사건 자료"
      >
        <BookOpen size={15} aria-hidden /> <span className="hidden md:inline">사건 자료</span>
      </button>
      <Modal
        open={open === "dossier"}
        onClose={() => setOpen(null)}
        eyebrow="SECRET DOSSIER"
        title="비밀 문서"
        wide
      >
        <DossierBody ctx={ctx} />
      </Modal>
      <Modal
        open={open === "file"}
        onClose={() => setOpen(null)}
        eyebrow="CASE FILE"
        title="사건 자료"
        wide
      >
        <div className="-mx-5 -mb-5 h-[70dvh]">
          <CaseFile ctx={ctx} className="h-full border-l-0" />
        </div>
      </Modal>
    </>
  );
}

/** 저택 평면도 + 장소 표시. 장소를 누르면 그 장소로 거른다 */
export function FloorPlan({
  ctx,
  selected,
  onSelect,
  counts,
  round,
}: {
  ctx: GameContext;
  selected: string;
  onSelect: (id: string) => void;
  counts: Record<string, number>;
  round: number;
}) {
  const scenario = ctx.scenario;
  if (!scenario?.meta.mapImageKey) return null;
  return (
    <div className="relative mx-auto aspect-[10/7] w-full max-w-3xl overflow-hidden rounded-[6px] border border-border bg-[var(--ink-950)]">
      {/* biome-ignore lint/performance/noImgElement: 정적 SVG 평면도 */}
      <img
        src={asset(scenario.meta.mapImageKey)}
        alt="블랙우드 저택 평면도"
        className="h-full w-full object-contain"
      />
      {scenario.locations.map((l) => {
        const open = round >= l.openFromRound;
        const active = selected === l.id;
        return (
          <button
            key={l.id}
            type="button"
            disabled={!open}
            onClick={() => onSelect(active ? "all" : l.id)}
            aria-pressed={active}
            className={cn(
              "absolute flex flex-col items-center justify-center gap-0.5 rounded-[3px] border text-center transition-colors",
              open
                ? "hover:bg-[color-mix(in_oklch,var(--brass-400)_14%,transparent)]"
                : "cursor-not-allowed",
              active
                ? "border-primary bg-[color-mix(in_oklch,var(--brass-400)_18%,transparent)]"
                : "border-transparent",
            )}
            style={{
              left: `${l.map.x}%`,
              top: `${l.map.y}%`,
              width: `${l.map.w}%`,
              height: `${l.map.h}%`,
            }}
          >
            <span
              className={cn(
                "rounded-[2px] px-1.5 py-0.5 text-[11px] font-semibold shadow-[var(--shadow-xs)] sm:text-xs",
                open
                  ? "bg-[var(--ink-900)]/85 text-[var(--paper-100)]"
                  : "bg-[var(--ink-900)]/70 text-muted-foreground",
              )}
            >
              {l.name}
              {open ? (
                counts[l.id] ? (
                  <span className="ml-1 font-mono text-primary">{counts[l.id]}</span>
                ) : null
              ) : (
                <span className="ml-1 font-mono text-[10px]">{l.openFromRound}R</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 단서 상세 창 */
export function ClueDetail({
  ctx,
  card,
  clue,
  onClose,
  actions,
}: {
  ctx: GameContext;
  card?: ClueCardInfo;
  clue?: ClueInfo;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const holder = card?.holderId ? ctx.character(card.holderId) : undefined;
  const sharer = card?.sharedBy ? ctx.character(card.sharedBy) : undefined;
  const category = clue?.category ?? card?.category;
  return (
    <Modal
      open={!!(card || clue)}
      onClose={onClose}
      eyebrow={`${clue?.code ?? card?.code ?? ""} · ${category ? CATEGORY[category].label : ""}`}
      title={clue?.title ?? "아직 내용을 모르는 단서"}
      footer={actions}
    >
      <ClueCard card={card} clue={clue} />
      <p className="mt-3 text-xs text-muted-foreground">
        {holder ? `${holder.name} 보유` : "보드 위"}
        {card?.isPublic && (sharer ? ` · ${josa(sharer.name, "이/가")} 공개` : " · 공통 자료")}
      </p>
    </Modal>
  );
}

export function MapToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={show}
      className={cn(btn.base, btn.ghost, btn.sm)}
    >
      <MapIcon size={15} aria-hidden /> {show ? "평면도 접기" : "평면도"}
    </button>
  );
}
