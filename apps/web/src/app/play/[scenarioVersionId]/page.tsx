import { GameRoom } from "@/components/game/game-room";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ scenarioVersionId: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { scenarioVersionId } = await params;
  const { room } = await searchParams;
  return <GameRoom scenarioVersionId={scenarioVersionId} roomId={room} />;
}
