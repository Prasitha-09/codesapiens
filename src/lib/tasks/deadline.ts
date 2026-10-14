/**
 * Deadline helpers for DISPLAY only. Whether a submission is accepted is decided
 * by the database (RLS compares the deadline with the database server's clock).
 */

export function isPastDeadline(deadline: string | null, now: Date): boolean {
  return deadline !== null && new Date(deadline).getTime() <= now.getTime();
}

const absolute = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDeadline(deadline: string): string {
  return `${absolute.format(new Date(deadline))} UTC`;
}

/** "in 3 days", "2 hours ago", "in 1 minute". */
export function relativeTime(iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const [unit, size] = units.find(([, ms]) => abs >= ms) ?? ["minute", 60_000];
  const value = Math.max(1, Math.round(abs / size));
  return new Intl.RelativeTimeFormat("en", { numeric: "always" }).format(diffMs >= 0 ? value : -value, unit);
}

/** "closes in 3 days", "closes in 2 hours", "closed 5 minutes ago". */
export function relativeDeadline(deadline: string, now: Date): string {
  const open = new Date(deadline).getTime() > now.getTime();
  return `${open ? "closes" : "closed"} ${relativeTime(deadline, now)}`;
}
