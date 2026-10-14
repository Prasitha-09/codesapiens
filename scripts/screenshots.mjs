// Visual check: screenshots of key pages at desktop, tablet and mobile widths.
//
//   npm run dev            (in another terminal)
//   npm run screenshots    → .screenshots/<page>-<viewport>.png
//
// Uses the locally installed Chrome (or Edge) via playwright-core; no browser
// download. Only public pages are captured — no credentials are used.

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const PAGES = (process.env.SCREENSHOT_PAGES ?? "/,/leaderboard,/login,/signup,/styleguide,/does-not-exist").split(",");
const FULL_PAGE = process.env.SCREENSHOT_FULLPAGE !== "0";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
];

await mkdir(".screenshots", { recursive: true });
let browser;
for (const channel of ["chrome", "msedge"]) {
  try {
    browser = await chromium.launch({ channel });
    break;
  } catch {
    /* try the next installed browser */
  }
}
if (!browser) {
  console.error("No local Chrome or Edge found.");
  process.exit(1);
}

const problems = [];
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (err) => problems.push(`${vp.name} ${page.url()}: page error ${err.message}`));
  page.on("console", (msg) => {
    // A 404 for the deliberately missing page is expected.
    if (msg.type() === "error" && !page.url().includes("does-not-exist")) problems.push(`${vp.name} ${page.url()}: console ${msg.text()}`);
  });
  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Horizontal overflow breaks mobile layouts.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) problems.push(`${vp.name} ${path}: horizontal overflow of ${overflow}px`);
    const name = path === "/" ? "home" : path.replace(/^\//, "").replace(/\//g, "_");
    await page.screenshot({ path: `.screenshots/${name}-${vp.name}.png`, fullPage: FULL_PAGE });
    console.log(`✓ ${name}-${vp.name}.png`);
  }
  await context.close();
}
await browser.close();

if (problems.length) {
  console.log("\nIssues:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("\nNo console errors or horizontal overflow detected.");
