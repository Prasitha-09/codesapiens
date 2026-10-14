import { describe, expect, it } from "vitest";
import { parseProfileForm } from "@/lib/profile/validation";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseProfileForm (server-side validation)", () => {
  it("normalizes valid input", () => {
    const result = parseProfileForm(
      form({
        username: "  Jane_Doe ",
        displayName: "  Jane  ",
        bio: "",
        isPublic: "on",
        "social.github": "github.com/janedoe",
        "social.website": "",
      }),
    );
    expect(result).toEqual({
      success: true,
      data: {
        username: "jane_doe",
        displayName: "Jane",
        bio: null,
        isPublic: true,
        socialLinks: { github: "https://github.com/janedoe" },
      },
    });
  });

  it("treats a missing checkbox as private", () => {
    const result = parseProfileForm(form({ username: "jane" }));
    expect(result.success && result.data.isPublic).toBe(false);
  });

  it("reports every invalid field at once", () => {
    const result = parseProfileForm(
      form({
        username: "no spaces allowed",
        displayName: "x".repeat(51),
        bio: "y".repeat(281),
        "social.website": "javascript:alert(1)",
        "social.x": "https://facebook.com/me",
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(
        ["bio", "displayName", "social.website", "social.x", "username"].sort(),
      );
    }
  });

  it("ignores fields that aren't part of the profile (e.g. role or id)", () => {
    const result = parseProfileForm(form({ username: "jane", role: "admin", id: "someone-else", public_slug: "x" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual(["bio", "displayName", "isPublic", "socialLinks", "username"]);
    }
  });
});
