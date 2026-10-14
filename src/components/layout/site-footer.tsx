import Link from "next/link";
import { memberNav, primaryNav, siteConfig } from "@/config/site";
import { Container } from "./container";
import { Logo } from "./logo";

const linkClass = "w-fit font-bold uppercase tracking-wide underline-offset-4 hover:text-mint hover:underline";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-[3px] border-ink bg-surface">
      <div aria-hidden="true" className="bg-hazard h-3 border-b-[3px] border-ink" />
      <Container className="grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex max-w-sm flex-col gap-4">
          <Logo />
          <p className="text-sm text-subtle">{siteConfig.tagline}</p>
        </div>
        <nav aria-label="Arena" className="flex flex-col gap-2">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-mint">Arena</p>
          {primaryNav.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Your account" className="flex flex-col gap-2">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-mint">You</p>
          {memberNav.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
      <Container className="flex flex-col gap-2 border-t border-ink/15 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs text-subtle">
          {siteConfig.name} · {siteConfig.product}
        </p>
        <p className="font-mono text-xs text-subtle">Coins are virtual points with no cash value.</p>
      </Container>
    </footer>
  );
}
