import { getSiteUrl } from "@/lib/supabase/env";

/** Same format as `profiles.public_slug` (12 lowercase hex characters). */
const SLUG_PATTERN = /^[a-f0-9]{12}$/;

export function isValidPublicSlug(slug: unknown): slug is string {
  return typeof slug === "string" && SLUG_PATTERN.test(slug);
}

/** Absolute public profile URL — what the QR code encodes. */
export function publicProfileUrl(slug: string, siteUrl: string = getSiteUrl()): string {
  if (!isValidPublicSlug(slug)) throw new Error("Invalid public profile slug");
  return new URL(`/u/${slug}`, siteUrl).toString();
}
