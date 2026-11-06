"use client";

import { type ScenarioInput, type ScenarioIssue, validateScenario } from "@mm/scenario-schema";
import { Button } from "@mm/ui";
import { useMemo, useState } from "react";

const PLAY_URL = process.env.NEXT_PUBLIC_PLAY_URL ?? "http://localhost:3000";

/**
 * 초기 에디터: JSON을 직접 고치고 공용 스키마로 검증한다.
 * 다음 단계에서 캐릭터·단서 폼(React Hook Form), 대본(Tiptap), 페이즈 흐름(React Flow)으로 바꾼다.
 */
export function ScenarioEditor({ initial }: { initial: ScenarioInput }) {
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));

  const result = useMemo((): { issues: ScenarioIssue[] } => {
    try {
      const r = validateScenario(JSON.parse(text));
      return { issues: r.ok ? [] : r.issues };
    } catch (e) {
      return { issues: [{ path: "", message: `JSON 문법 오류: ${(e as Error).message}` }] };
    }
  }, [text]);

  return (
    <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[1fr_320px]">
      <textarea
        className="min-h-[70dvh] w-full rounded-lg border border-input bg-[var(--input-bg)] p-3 font-mono text-sm"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <aside className="space-y-4">
        <h2 className="font-serif text-lg font-bold">발행 전 검사</h2>
        {result.issues.length === 0 ? (
          <p className="text-sm text-[var(--alibi)]">문제가 없습니다. 발행할 수 있습니다.</p>
        ) : (
          <ul className="space-y-1 text-sm text-[var(--destructive-text)]">
            {result.issues.map((i) => (
              <li key={`${i.path}-${i.message}`}>
                <span className="font-mono">{i.path || "(전체)"}</span> {i.message}
              </li>
            ))}
          </ul>
        )}
        <Button disabled={result.issues.length > 0} className="w-full">
          발행 (준비 중)
        </Button>
        <a
          className="block text-center text-sm underline"
          href={`${PLAY_URL}/play/sample`}
          target="_blank"
          rel="noreferrer"
        >
          테스트 플레이 (샘플)
        </a>
      </aside>
    </main>
  );
}
