import type { GroupDetails } from "@shared/models/GroupDetails";
import type { GroupSignupRequest } from "@shared/models/GroupSignupRequest";
import { ProviderError } from "@/errors/ProviderError";
import { invokeFunction } from "./supabaseFunctions";

// The function explains expected failures (for example "This group is full"),
// so its own message is shown to the visitor.
const messages = { service: "group signup" };

export async function getGroupDetails(token: string): Promise<GroupDetails> {
  const data = await invokeFunction<{ group: GroupDetails }>(
    `group-public-signup?token=${encodeURIComponent(token)}`,
    { method: "GET" },
    { ...messages, fallback: "Group not found" }
  );

  if (!data?.group) throw new ProviderError("No group details were returned.");

  return data.group;
}

export async function submitGroupSignup(request: GroupSignupRequest): Promise<void> {
  await invokeFunction(
    "group-public-signup",
    { body: request },
    { ...messages, fallback: "Failed to submit signup" }
  );
}
