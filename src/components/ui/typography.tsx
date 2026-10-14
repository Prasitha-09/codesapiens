import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Condensed, oversized display headline (Anton). */
export function Display({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "font-display text-6xl uppercase leading-[0.88] tracking-tight sm:text-7xl lg:text-8xl xl:text-[8.5rem]",
        className,
      )}
      {...props}
    />
  );
}

export function H1({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn("font-display text-5xl uppercase leading-[0.95] tracking-tight sm:text-6xl", className)}
      {...props}
    />
  );
}

export function H2({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-display text-4xl uppercase leading-[0.95] tracking-tight sm:text-5xl", className)}
      {...props}
    />
  );
}

export function H3({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-xl font-bold leading-snug", className)} {...props} />;
}

export function Lead({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-lg leading-relaxed text-subtle sm:text-xl", className)} {...props} />;
}

export function Text({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("leading-relaxed", className)} {...props} />;
}

/** Small mono label above headings. */
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("font-mono text-sm font-bold uppercase tracking-[0.25em] text-mint", className)}
      {...props}
    />
  );
}

/** Inline highlighted word, e.g. inside a heading. */
export function Highlight({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-block -rotate-1 border-[3px] border-ink bg-mint px-2 text-on-accent shadow-brutal",
        className,
      )}
      {...props}
    />
  );
}
