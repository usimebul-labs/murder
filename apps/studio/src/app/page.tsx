import { sampleScenario } from "@mm/scenario-schema";
import Link from "next/link";

export default function StudioHome() {
  // TODO: Supabase의 scenarios 테이블에서 내 시나리오 목록을 불러온다
  const scenarios = [{ slug: sampleScenario.id, title: sampleScenario.meta.title }];
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header>
        <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">STUDIO</p>
        <h1 className="font-display text-3xl">시나리오</h1>
      </header>
      <ul className="space-y-2">
        {scenarios.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/scenarios/${s.slug}`}
              className="block rounded-lg border border-border bg-card p-4 hover:border-primary"
            >
              <p className="font-semibold">{s.title}</p>
              <p className="font-mono text-xs text-muted-foreground">{s.slug}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
