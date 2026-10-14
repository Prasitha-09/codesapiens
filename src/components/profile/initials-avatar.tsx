import { cn } from "@/lib/utils";

/** Initials in a bold block — used until profile photos exist. Decorative (aria-hidden). */
export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center border-[3px] border-ink bg-sun font-display leading-none text-on-accent shadow-brutal",
        className,
      )}
    >
      {initials}
    </span>
  );
}
