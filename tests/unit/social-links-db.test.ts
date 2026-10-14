// The app (TypeScript) and the database (CHECK constraint) validate social links
// independently. This test applies the real migrations to an in-memory Postgres
// and checks that both sides agree, so the database never rejects a link the
// form accepted — and never accepts one the form would reject.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SOCIAL_PLATFORMS, normalizeSocialLink, type SocialPlatform } from "@/lib/profile/social-links";

const root = path.resolve(import.meta.dirname, "../..");
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(path.join(root, "tests/db/supabase-stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(await readFile(path.join(dir, file), "utf8"));
  }
});

afterAll(async () => {
  await db?.close();
});

async function dbAccepts(platform: string, value: unknown): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>("select public.valid_social_links($1::jsonb) as ok", [
    JSON.stringify({ [platform]: value }),
  ]);
  return rows[0].ok;
}

const inputs: Record<SocialPlatform, string[]> = {
  website: ["example.com", "https://sub.example.co.uk/path?q=1#top", "http://EXAMPLE.com", "javascript:alert(1)", "https://localhost/", "https://a@b.com/"],
  github: ["github.com/octocat", "https://www.github.com/a-b/", "https://github.com/a/b", "https://gitlab.com/a"],
  linkedin: ["linkedin.com/in/jane-doe", "https://uk.linkedin.com/company/acme/", "https://linkedin.com/feed"],
  x: ["x.com/jack", "https://twitter.com/jack_", "https://x.com/way_too_long_handle_here"],
  instagram: ["instagram.com/a.b_c", "https://www.instagram.com/", "https://instagram.com/a/b"],
  youtube: ["youtube.com/@name", "https://youtube.com/c/Name", "https://youtube.com/watch?v=1", "https://youtu.be/x"],
};

describe("social link validation: app and database agree", () => {
  for (const spec of SOCIAL_PLATFORMS) {
    for (const input of inputs[spec.id]) {
      it(`${spec.id}: ${input}`, async () => {
        const result = normalizeSocialLink(spec.id, input);
        if (result.ok && result.value) {
          // Everything the form accepts must be storable.
          expect(await dbAccepts(spec.id, result.value)).toBe(true);
        } else {
          // Raw input the form rejects must also be rejected by the database.
          expect(await dbAccepts(spec.id, input)).toBe(false);
        }
      });
    }
  }

  it("database rejects unknown platforms and non-string values", async () => {
    expect(await dbAccepts("myspace", "https://myspace.com/tom")).toBe(false);
    expect(await dbAccepts("website", 42)).toBe(false);
    expect(await dbAccepts("website", `https://example.com/${"a".repeat(300)}`)).toBe(false);
  });
});
