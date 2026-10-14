/**
 * Allow-listed public social links.
 *
 * The patterns MUST match `public.valid_social_links()` in
 * supabase/migrations/20261014000003_profile_social_links.sql — the database is
 * the final guard, and tests/unit/social-links-db.test.ts checks both agree.
 */

export const SOCIAL_PLATFORMS = [
  {
    id: "website",
    label: "Website",
    example: "https://yourname.com",
    pattern: /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?(\/[^\s<>"]*)?$/,
  },
  {
    id: "github",
    label: "GitHub",
    example: "https://github.com/yourname",
    pattern: /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9-]{1,39}\/?$/,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    example: "https://www.linkedin.com/in/yourname",
    pattern: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%-]{1,100}\/?$/,
  },
  {
    id: "x",
    label: "X (Twitter)",
    example: "https://x.com/yourname",
    pattern: /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?$/,
  },
  {
    id: "instagram",
    label: "Instagram",
    example: "https://instagram.com/yourname",
    pattern: /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]{1,30}\/?$/,
  },
  {
    id: "youtube",
    label: "YouTube",
    example: "https://youtube.com/@yourname",
    pattern: /^https:\/\/(www\.)?youtube\.com\/(@[A-Za-z0-9_.-]{1,100}|(c|channel|user)\/[A-Za-z0-9_.-]{1,100})\/?$/,
  },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["id"];
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export const SOCIAL_URL_MAX_LENGTH = 300;

const byId = new Map(SOCIAL_PLATFORMS.map((p) => [p.id, p]));

export function isSocialPlatform(value: string): value is SocialPlatform {
  return byId.has(value as SocialPlatform);
}

export type SocialLinkResult = { ok: true; value: string | null } | { ok: false; error: string };

/**
 * Normalize and validate one link as the user typed it.
 * - Empty input → `null` (link removed).
 * - Missing scheme → `https://` is added; `http://` is upgraded to `https://`.
 * - Rejects other schemes (javascript:, data:, …), embedded credentials, and
 *   URLs that don't point at the platform's own site.
 */
export function normalizeSocialLink(platform: SocialPlatform, raw: string): SocialLinkResult {
  const spec = byId.get(platform);
  if (!spec) return { ok: false, error: "Unknown platform." };

  const input = raw.trim();
  if (input === "") return { ok: true, value: null };

  const invalid = { ok: false as const, error: `Enter a valid ${spec.label} link, like ${spec.example}` };

  // Only add a scheme when none is present; never "fix" javascript:, data:, etc.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(input);
  if (hasScheme && !/^https?:\/\//i.test(input)) return invalid;
  const withScheme = hasScheme ? input : `https://${input}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return invalid;
  }
  if (url.username || url.password) return invalid;
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") return invalid;

  const value = url.href;
  if (value.length > SOCIAL_URL_MAX_LENGTH) {
    return { ok: false, error: `Links can be at most ${SOCIAL_URL_MAX_LENGTH} characters.` };
  }
  if (!spec.pattern.test(value)) return invalid;
  return { ok: true, value };
}

/**
 * Defensive reader for links coming back from the database: keeps only known
 * platforms whose value still passes validation, in display order.
 */
export function readSocialLinks(json: unknown): { platform: SocialPlatform; label: string; url: string }[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  const record = json as Record<string, unknown>;
  return SOCIAL_PLATFORMS.flatMap((spec) => {
    const value = record[spec.id];
    if (typeof value !== "string" || !spec.pattern.test(value)) return [];
    return [{ platform: spec.id, label: spec.label, url: value }];
  });
}
