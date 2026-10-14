import { describe, expect, it } from "vitest";
import { buildActivity } from "@/lib/arena/activity";
import type { LedgerRow } from "@/lib/coins/ledger";
import type { MySubmission } from "@/lib/tasks/data";

const sub = (over: Partial<MySubmission>): MySubmission => ({
  id: "s1",
  task_id: "t1",
  status: "pending",
  proof_text: "x",
  proof_url: null,
  has_evidence: false,
  review_note: null,
  created_at: "2026-10-10T10:00:00Z",
  reviewed_at: null,
  ...over,
});

const titles = new Map([
  ["t1", { title: "Build a CLI" }],
  ["t2", { title: "Write docs" }],
]);

describe("buildActivity", () => {
  it("merges submissions, reviews and coin entries newest first", () => {
    const ledger: LedgerRow[] = [
      { id: 7, amount: 40, kind: "task_reward", reason: null, created_at: "2026-10-12T09:00:00Z", task_title: "Build a CLI" },
    ];
    const events = buildActivity(
      [
        sub({ id: "s1", task_id: "t1", status: "approved", reviewed_at: "2026-10-12T09:00:00Z" }),
        sub({ id: "s2", task_id: "t2", status: "rejected", created_at: "2026-10-11T08:00:00Z", reviewed_at: "2026-10-13T08:00:00Z", review_note: "Missing link" }),
      ],
      ledger,
      titles,
    );
    // The reward and its approval share a timestamp: the reward is listed first.
    expect(events.map((e) => e.kind)).toEqual(["rejected", "coins", "approved", "submitted", "submitted"]);
    expect(events[0]).toMatchObject({ title: "Write docs", detail: "Missing link", href: "/tasks/t2" });
    expect(events[1]).toMatchObject({ amount: 40, title: "Build a CLI", href: "/wallet" });
  });

  it("does not invent review events for pending submissions", () => {
    const events = buildActivity([sub({})], [], titles);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("submitted");
  });

  it("labels admin adjustments with their reason and respects the limit", () => {
    const ledger: LedgerRow[] = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      amount: -1,
      kind: "admin_adjustment" as const,
      reason: "Correction",
      created_at: `2026-10-01T00:${String(i).padStart(2, "0")}:00Z`,
      task_title: null,
    }));
    const events = buildActivity([], ledger, titles, 5);
    expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({ title: "Coin adjustment", detail: "Correction", amount: -1 });
  });

  it("returns an empty feed when there is no history", () => {
    expect(buildActivity([], [], titles)).toEqual([]);
  });
});
