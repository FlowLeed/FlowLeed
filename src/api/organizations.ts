import { functionUrl } from "./supabaseFunctions";

// Loaded by an <img> tag, so this is an address rather than a call
// (invoke would decode the image as text).
export const getOrganizationLogoUrl = (slug: string): string =>
  functionUrl("public-org-logo", { slug });
