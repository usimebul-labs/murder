import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-4">
      <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">CASE FILE · 00</p>
      <h1 className="font-display text-4xl">당신은 누구입니까</h1>
      <p className="text-muted-foreground">비공개 데모입니다. 초대받은 분만 입장할 수 있습니다.</p>
      <Link
        href="/play/sample"
        className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        샘플 사건 입장
      </Link>
    </main>
  );
}
