import { Lobby } from "@/components/lobby/lobby";
import { getCurrentUser } from "@/lib/supabase/server";
import { THEMES } from "@/lib/themes";

export default async function HomePage() {
  const user = await getCurrentUser();
  return <Lobby themes={THEMES} signedIn={!!user} />;
}
