import type { InvitationData } from "@shared/models/InvitationData";
import { ProviderError } from "@/errors/ProviderError";
import { invokeFunction } from "./supabaseFunctions";

export async function getInvitationDetails(token: string): Promise<InvitationData> {
  const data = await invokeFunction<InvitationData>(
    "get-invitation-details",
    { body: { token } },
    { service: "invitation", fallback: "Unable to retrieve invitation details.", useServerMessage: false }
  );

  if (!data) throw new ProviderError("No invitation data was returned.");

  return data;
}
