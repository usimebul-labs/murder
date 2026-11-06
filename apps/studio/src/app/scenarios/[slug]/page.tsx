import { sampleScenario } from "@mm/scenario-schema";
import { notFound } from "next/navigation";
import { ScenarioEditor } from "@/components/scenario-editor";

export default async function ScenarioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // TODO: scenario_drafts에서 초안을 불러온다
  if (slug !== sampleScenario.id) notFound();
  return <ScenarioEditor initial={sampleScenario} />;
}
