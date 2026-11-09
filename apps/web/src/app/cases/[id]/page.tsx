import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseDetail } from "@/components/lobby/case-detail";
import { getCurrentUser } from "@/lib/supabase/server";
import { findTheme, THEMES, themeDetail } from "@/lib/themes";

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
  const user = await getCurrentUser();
  return <CaseDetail theme={theme} detail={themeDetail(theme)} signedIn={!!user} />;
}
