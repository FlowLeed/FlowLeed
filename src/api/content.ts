import type { AskResponse } from "@shared/models/AskResponse";
import { invokeFunction } from "./supabaseFunctions";

export async function askPublicLibrary(query: string, orgSlug: string): Promise<AskResponse> {
  const data = await invokeFunction<AskResponse>(
    "content-ask",
    { body: { query, orgSlug, public: true } },
    { service: "story search", fallback: "Unable to search the story library." }
  );

  return data ?? { answer: "", sources: [] };
}
