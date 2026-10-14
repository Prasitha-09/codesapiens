import { describe, expect, it } from "vitest";
import { formatDeadline, isPastDeadline, relativeDeadline } from "@/lib/tasks/deadline";

const now = new Date("2026-10-14T12:00:00Z");

describe("deadline display helpers", () => {
  it("treats no deadline as open", () => {
    expect(isPastDeadline(null, now)).toBe(false);
  });

  it("is closed exactly at the deadline and after it", () => {
    expect(isPastDeadline("2026-10-14T12:00:00Z", now)).toBe(true);
    expect(isPastDeadline("2026-10-14T11:59:59Z", now)).toBe(true);
    expect(isPastDeadline("2026-10-14T12:00:01Z", now)).toBe(false);
  });

  it("describes time remaining and time since closing", () => {
    expect(relativeDeadline("2026-10-17T12:00:00Z", now)).toBe("closes in 3 days");
    expect(relativeDeadline("2026-10-14T14:00:00Z", now)).toBe("closes in 2 hours");
    expect(relativeDeadline("2026-10-14T12:00:30Z", now)).toBe("closes in 1 minute");
    expect(relativeDeadline("2026-10-14T11:55:00Z", now)).toBe("closed 5 minutes ago");
  });

  it("formats absolute deadlines in UTC", () => {
    expect(formatDeadline("2026-10-14T18:30:00Z")).toBe("14 Oct 2026, 18:30 UTC");
  });
});
