import { describe, expect, it } from "vitest";
import { normalizeSocialLink, readSocialLinks } from "@/lib/profile/social-links";

describe("normalizeSocialLink", () => {
  it.each([
    ["website", "https://example.com", "https://example.com/"],
    ["website", "example.com/about", "https://example.com/about"],
    ["website", "http://Example.COM/Path", "https://example.com/Path"],
    ["github", "github.com/octocat", "https://github.com/octocat"],
    ["github", "https://www.github.com/octo-cat/", "https://www.github.com/octo-cat/"],
    ["linkedin", "https://www.linkedin.com/in/jane-doe", "https://www.linkedin.com/in/jane-doe"],
    ["linkedin", "linkedin.com/company/acme", "https://linkedin.com/company/acme"],
    ["x", "https://twitter.com/jack", "https://twitter.com/jack"],
    ["x", "x.com/some_user", "https://x.com/some_user"],
    ["instagram", "instagram.com/some.user_1", "https://instagram.com/some.user_1"],
    ["youtube", "https://youtube.com/@channel.name", "https://youtube.com/@channel.name"],
    ["youtube", "https://www.youtube.com/channel/UC123abc", "https://www.youtube.com/channel/UC123abc"],
  ] as const)("accepts %s link %s", (platform, input, expected) => {
    expect(normalizeSocialLink(platform, input)).toEqual({ ok: true, value: expected });
  });

  it("treats empty input as removing the link", () => {
    expect(normalizeSocialLink("github", "   ")).toEqual({ ok: true, value: null });
  });

  it.each([
    ["website", "javascript:alert(1)"],
    ["website", "JavaScript:alert(1)"],
    ["website", "data:text/html,<script>alert(1)</script>"],
    ["website", "ftp://example.com/file"],
    ["website", "https://user:pass@example.com/"],
    ["website", "https://localhost/"],
    ["website", "not a url"],
    ["github", "https://evil.example/octocat"],
    ["github", "https://github.com.evil.example/octocat"],
    ["github", "https://github.com/octocat/repo"],
    ["github", "https://github.com/octocat?tab=repos"],
    ["linkedin", "https://linkedin.com/feed/"],
    ["x", "https://x.com/this_handle_is_far_too_long"],
    ["instagram", "https://instagram.com/user/posts"],
    ["youtube", "https://youtube.com/watch?v=abc"],
  ] as const)("rejects %s link %s", (platform, input) => {
    const result = normalizeSocialLink(platform, input);
    expect(result.ok).toBe(false);
  });

  it("stores the URL the browser would actually open (dot segments resolved)", () => {
    expect(normalizeSocialLink("instagram", "https://instagram.com/user/../../other")).toEqual({
      ok: true,
      value: "https://instagram.com/other",
    });
  });

  it("rejects links longer than 300 characters", () => {
    const result = normalizeSocialLink("website", `https://example.com/${"a".repeat(300)}`);
    expect(result).toEqual({ ok: false, error: "Links can be at most 300 characters." });
  });

  it("gives a helpful message naming the platform", () => {
    const result = normalizeSocialLink("github", "https://gitlab.com/me");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("GitHub");
  });
});

describe("readSocialLinks (defensive read of stored data)", () => {
  it("keeps only known platforms with valid https URLs, in display order", () => {
    const links = readSocialLinks({
      x: "https://x.com/jack",
      website: "https://example.com/",
      github: "javascript:alert(1)",
      myspace: "https://myspace.com/tom",
      instagram: 42,
    });
    expect(links).toEqual([
      { platform: "website", label: "Website", url: "https://example.com/" },
      { platform: "x", label: "X (Twitter)", url: "https://x.com/jack" },
    ]);
  });

  it.each([null, undefined, "string", 5, ["https://example.com/"]])("returns [] for non-object %j", (value) => {
    expect(readSocialLinks(value)).toEqual([]);
  });
});
