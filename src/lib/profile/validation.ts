import { z } from "zod";
import { usernameSchema } from "@/lib/auth/validation";
import { SOCIAL_PLATFORMS, normalizeSocialLink, type SocialLinks } from "./social-links";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const profileFieldsSchema = z.object({
  username: usernameSchema,
  displayName: optionalText(50, "Display name"),
  bio: optionalText(280, "Bio"),
});

export type ProfileInput = {
  username: string;
  displayName: string | null;
  bio: string | null;
  isPublic: boolean;
  socialLinks: SocialLinks;
};

/** Field names used for errors; social links are `social.<platform>`. */
export type ProfileFieldErrors = Record<string, string>;

export type ProfileParseResult =
  | { success: true; data: ProfileInput }
  | { success: false; fieldErrors: ProfileFieldErrors };

/** Server-side validation of the profile form. Never trust the browser's checks. */
export function parseProfileForm(formData: FormData): ProfileParseResult {
  const fieldErrors: ProfileFieldErrors = {};

  const fields = profileFieldsSchema.safeParse({
    username: String(formData.get("username") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    bio: String(formData.get("bio") ?? ""),
  });
  if (!fields.success) {
    for (const issue of fields.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
  }

  const socialLinks: SocialLinks = {};
  for (const spec of SOCIAL_PLATFORMS) {
    const result = normalizeSocialLink(spec.id, String(formData.get(`social.${spec.id}`) ?? ""));
    if (!result.ok) fieldErrors[`social.${spec.id}`] = result.error;
    else if (result.value) socialLinks[spec.id] = result.value;
  }

  if (!fields.success || Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };

  return {
    success: true,
    data: {
      ...fields.data,
      // A checkbox is only submitted when ticked.
      isPublic: formData.get("isPublic") === "on",
      socialLinks,
    },
  };
}
