import type { ChurchOnlineConnectionTest } from "@shared/models/ChurchOnlineConnectionTest";
import { functionUrl, invokeFunction } from "./supabaseFunctions";

// Church Online calls this address itself; it is shown to the admin to copy.
export const getChurchOnlineWebhookUrl = (integrationId: string): string =>
  functionUrl("church-online-webhook", { integration_id: integrationId });

/**
 * Tests a Church Online connection, for a domain being added or an existing integration.
 * When Church Online itself can't be reached the function still answers, with
 * `{ success: false, error }`; only a failed call to the function throws.
 */
export async function testChurchOnlineConnection(
  target: { domain: string } | { integrationId: string }
): Promise<ChurchOnlineConnectionTest> {
  const data = await invokeFunction<ChurchOnlineConnectionTest>(
    "church-online-test-connection",
    { body: target },
    { service: "Church Online", fallback: "Failed to connect to Church Online Platform" }
  );

  return data ?? { success: false };
}
