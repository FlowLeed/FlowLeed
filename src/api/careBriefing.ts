import type { CareBriefingRunRequest, CareBriefingRunResult } from "@shared/models/CareBriefingRun";
import { invokeFunction } from "./supabaseFunctions";

/** Today on the leader's own clock (YYYY-MM-DD). UTC's date rolls over early for the Americas. */
function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Prepares today's care briefing for the signed-in leader. */
export async function runCareBriefing(organizationId: string): Promise<CareBriefingRunResult> {
  const request: CareBriefingRunRequest = { organizationId, localDate: localDate() };
  const data = await invokeFunction<CareBriefingRunResult>(
    "care-agent-run",
    { body: request },
    { service: "care briefing", fallback: "Couldn't prepare the briefing." }
  );

  return data ?? {};
}
