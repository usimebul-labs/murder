import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { safeNextPath } from "@/lib/safe-next-path";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="nm-scene flex min-h-dvh items-start justify-center min-[600px]:items-center min-[600px]:px-6 min-[600px]:py-12">
      <main className="flex w-full max-w-[448px] flex-col gap-6 rounded-lg px-5 pt-6 pb-10 min-[600px]:border min-[600px]:border-border min-[600px]:bg-card min-[600px]:px-10 min-[600px]:pt-9 min-[600px]:shadow-[var(--shadow-raised)]">
        <header className="flex flex-col items-center gap-1.5 pt-2">
          <h1 className="text-center font-display text-[22px] leading-none font-semibold tracking-[0.14em]">
            MURDER MYSTERY
          </h1>
          <p
            className="text-muted-foreground"
            style={{ font: "var(--type-caps)", letterSpacing: "var(--tracking-caps)" }}
          >
            머더 미스터리
          </p>
        </header>
        <AuthCard next={next} initialError={Boolean(error)} />
      </main>
    </div>
  );
}
