import { ChevronLeft, DoorOpen, Hourglass, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityBadge, Cover, ThemeBadges } from "@/components/lobby/theme-meta";
import { playPath } from "@/lib/theme";
import { findTheme, THEMES } from "@/lib/themes";

export function generateStaticParams() {
  return THEMES.map((t) => ({ id: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const theme = findTheme((await params).id);
  return theme ? { title: `${theme.title} · 머더 미스터리`, description: theme.hook } : {};
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const theme = findTheme((await params).id);
  if (!theme) notFound();
  const play = playPath(theme);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-[color-mix(in_oklch,var(--background)_92%,transparent)] pr-4 pl-2 backdrop-blur-[6px]">
        <Link href="/" className="nm-btn nm-btn--ghost nm-btn--sm">
          <ChevronLeft size={16} aria-hidden /> 로비
        </Link>
        <span className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          CASE FILE · {theme.caseNumber}
        </span>
      </header>

      <section className="relative h-[clamp(280px,48vh,520px)] overflow-hidden">
        <Cover theme={theme} brightness={0.8} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,var(--background)_100%)]" />
      </section>

      <main className="relative z-[2] mx-auto -mt-24 flex max-w-3xl flex-col gap-8 px-4 pb-20 sm:px-6">
        <div className="flex flex-col gap-4">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {theme.year} · {theme.place}
          </span>
          <h1 className="font-serif text-[clamp(30px,5vw,48px)] font-bold leading-[1.15] [text-wrap:balance]">
            {theme.title}
          </h1>
          <p className="font-serif text-lg leading-[1.7] text-foreground [text-wrap:pretty]">
            {theme.hook}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <AvailabilityBadge theme={theme} />
          </div>
          <ThemeBadges theme={theme} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {play ? (
            <Link href={play} className="nm-btn nm-btn--primary nm-btn--lg">
              <DoorOpen size={18} aria-hidden /> 새 사건 열기
            </Link>
          ) : (
            <button type="button" disabled className="nm-btn nm-btn--secondary nm-btn--lg">
              <Hourglass size={18} aria-hidden /> 준비 중
            </button>
          )}
          <p className="text-sm text-muted-foreground">
            {play
              ? "방을 만든 뒤 초대 링크를 함께할 사람들에게 보내 주세요."
              : "아직 대본과 단서를 준비하고 있어요. 지금은 블랙우드 저택을 플레이할 수 있어요."}
          </p>
        </div>

        <section className="nm-card nm-card--paper">
          <div className="nm-card__body flex flex-col gap-3 text-[var(--paper-ink)]">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--paper-ink-muted)]">
              SYNOPSIS · 사건 개요
            </span>
            <p className="font-serif text-base leading-7 [text-wrap:pretty]">{theme.synopsis}</p>
          </div>
        </section>

        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <dt className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              태그
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {theme.tags.map((tag) => (
                <span key={tag} className="nm-badge">
                  {tag}
                </span>
              ))}
            </dd>
          </div>
          {theme.contentWarnings.length > 0 && (
            <div className="flex flex-col gap-2">
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                콘텐츠 주의
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {theme.contentWarnings.map((w) => (
                  <span key={w} className="nm-badge">
                    <TriangleAlert size={12} aria-hidden /> {w}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </main>
    </div>
  );
}
