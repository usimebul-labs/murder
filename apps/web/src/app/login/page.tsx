import { redirect } from "next/navigation";
import { LoginButtons } from "@/components/login-buttons";
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-4">
      <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">
        CASE FILE · SIGN IN
      </p>
      <h1 className="font-display text-4xl">신원을 확인합니다</h1>
      <p className="text-muted-foreground">사건 현장에 입장하려면 로그인이 필요합니다.</p>
      <LoginButtons next={next} initialError={Boolean(error)} />
    </main>
  );
}
