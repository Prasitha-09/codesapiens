import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-surface text-ink",
  mint: "bg-mint text-on-accent",
  sun: "bg-sun text-on-accent",
  sky: "bg-sky text-on-accent",
  pink: "bg-pink text-on-accent",
  danger: "bg-danger text-on-accent",
  ink: "bg-ink text-paper",
} as const;

export type BadgeTone = keyof typeof tones;

type BadgeProps = ComponentProps<"span"> & { tone?: BadgeTone };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-brutal border-2 border-ink px-2 py-0.5",
        "font-mono text-xs font-bold uppercase tracking-wider",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
