import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type FunctionInvokeOptions,
} from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { ProviderError } from "@/errors/ProviderError";

interface ErrorMessages {
  /** Used in messages, e.g. "group signup" → "Unable to connect to the group signup service." */
  service: string;
  /** Shown when the function returns an error status. */
  fallback: string;
  /** Show the function's own `error` text instead of `fallback` when it sends one. Defaults to true. */
  useServerMessage?: boolean;
}

/**
 * Calls an Edge Function and turns any failure into a ProviderError whose message
 * is safe to show to users.
 */
export async function invokeFunction<T>(
  functionName: string,
  options: FunctionInvokeOptions,
  messages: ErrorMessages
): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke(functionName, options);

  if (!error) return (data as T) ?? null;

  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    console.error("Edge Function failed", body);
    // Functions send { error: "..." }; responses relayed from an AI gateway may send { error: { message } }.
    const serverError = typeof body?.error === "string" ? body.error : body?.error?.message;
    const serverMessage = messages.useServerMessage === false || typeof serverError !== "string" ? null : serverError;
    throw new ProviderError(serverMessage ?? messages.fallback, error);
  }

  if (error instanceof FunctionsRelayError) {
    console.error(`Gateway error: ${error.message}`);
    throw new ProviderError(`The ${messages.service} service is temporarily unavailable.`, error);
  }

  if (error instanceof FunctionsFetchError) {
    console.error(`Network error: ${error.message}`);
    throw new ProviderError(`Unable to connect to the ${messages.service} service.`, error);
  }

  throw new ProviderError("An unexpected error occurred.", error);
}

/**
 * Address of an Edge Function, for when the browser or a third party calls it directly
 * (an <img> source, a webhook URL) instead of invokeFunction. Uses the same
 * environment variable as the Supabase client.
 */
export function functionUrl(functionName: string, params: Record<string, string> = {}): string {
  const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}
