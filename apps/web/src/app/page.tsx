import { Button } from "@mm/ui";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-4">
      <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">CASE FILE · 00</p>
      <h1 className="font-display text-4xl">당신은 누구입니까</h1>
      <p className="text-muted-foreground">비공개 데모입니다. 초대받은 분만 입장할 수 있습니다.</p>
      <div className="flex flex-col gap-3">
        <Link
          href="/play/sample"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          샘플 사건 입장
        </Link>
        {user && (
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" className="w-full">
              로그아웃
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
