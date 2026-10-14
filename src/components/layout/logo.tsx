import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** Code Sapiens wordmark: a lime "CS" block with a condensed wordmark. */
export function Logo({ className, showProduct = true }: { className?: string; showProduct?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-3", className)}
      aria-label={`${siteConfig.name} — ${siteConfig.product}, home`}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center border-[3px] border-ink bg-mint font-display text-xl leading-none text-on-accent shadow-brutal-sm transition-transform group-hover:-rotate-6"
      >
        CS
      </span>
      <span aria-hidden="true" className="flex flex-col leading-none">
        <span className="font-display text-2xl uppercase tracking-wide">{siteConfig.name}</span>
        {showProduct && (
          <span className="hidden font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-mint sm:block">
            {siteConfig.product}
          </span>
        )}
      </span>
    </Link>
  );
}
