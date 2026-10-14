import { describe, expect, it } from "vitest";
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
  parseAdjustForm,
  parseReviewForm,
  parseRoleForm,
  parseTaskForm,
} from "@/lib/admin/validation";

const now = new Date("2026-10-14T12:00:00Z");
const ID = "3f0c7a52-8a5e-4c1e-9d2f-1a2b3c4d5e6f";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validTask = {
  title: "Write a review",
  description: "Write a short review of TaskMint.",
  requirements: "",
  reward_coins: "25",
  deadline: "2026-10-20T18:30",
  status: "active",
};

describe("datetime-local ⇄ ISO (UTC)", () => {
  it("interprets the input as UTC and round-trips", () => {
    expect(datetimeLocalToIso("2026-10-20T18:30")).toBe("2026-10-20T18:30:00.000Z");
    expect(isoToDatetimeLocal("2026-10-20T18:30:00.000Z")).toBe("2026-10-20T18:30");
    expect(isoToDatetimeLocal(null)).toBe("");
  });
  it.each(["", "2026-10-20", "2026-13-40T99:99", "tomorrow", "2026-10-20T18:30:00Z"])("rejects %j", (v) => {
    expect(datetimeLocalToIso(v)).toBeNull();
  });
});

describe("parseTaskForm", () => {
  it("accepts a valid task and normalizes fields", () => {
    const result = parseTaskForm(form({ ...validTask, evidence_required: "on" }), { now });
    expect(result).toEqual({
      success: true,
      data: {
        title: "Write a review",
        description: "Write a short review of TaskMint.",
        requirements: null,
        reward_coins: 25,
        deadline: "2026-10-20T18:30:00.000Z",
        evidence_required: true,
        status: "active",
      },
    });
  });

  it.each([
    ["title", "ab"],
    ["description", "   "],
    ["reward_coins", "0"],
    ["reward_coins", "10001"],
    ["reward_coins", "2.5"],
    ["reward_coins", "abc"],
    ["status", "deleted"],
    ["deadline", "not a date"],
  ])("rejects invalid %s %j", (field, value) => {
    const result = parseTaskForm(form({ ...validTask, [field]: value }), { now });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors[field]).toBeDefined();
  });

  it("refuses to publish a task with a past deadline", () => {
    const result = parseTaskForm(form({ ...validTask, deadline: "2026-10-14T11:59" }), { now });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.deadline).toMatch(/future/);
  });

  it("allows a past deadline on a draft or archived task", () => {
    for (const status of ["draft", "archived"]) {
      const result = parseTaskForm(form({ ...validTask, status, deadline: "2026-01-01T00:00" }), { now });
      expect(result.success).toBe(true);
    }
  });

  it("allows editing other fields of an active task whose (unchanged) deadline has passed", () => {
    const previous = { status: "active" as const, deadline: "2026-10-01T00:00:00.000Z" };
    const result = parseTaskForm(form({ ...validTask, deadline: "2026-10-01T00:00", title: "Renamed" }), { now, previous });
    expect(result.success).toBe(true);
  });

  it("ignores client attempts to set server-owned fields", () => {
    const result = parseTaskForm(form({ ...validTask, created_by: ID, id: ID, created_at: "2000-01-01" }), { now });
    expect(result.success && Object.keys(result.data).sort()).toEqual(
      ["deadline", "description", "evidence_required", "requirements", "reward_coins", "status", "title"].sort(),
    );
  });
});

describe("parseReviewForm", () => {
  it("accepts an approval without a note", () => {
    expect(parseReviewForm(form({ submissionId: ID, decision: "approved" }))).toEqual({
      success: true,
      data: { submissionId: ID, decision: "approved", note: null },
    });
  });

  it("requires a reason to reject", () => {
    for (const note of ["", "  ", "no"]) {
      const result = parseReviewForm(form({ submissionId: ID, decision: "rejected", note }));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.fieldErrors.note).toMatch(/reason/);
    }
    expect(parseReviewForm(form({ submissionId: ID, decision: "rejected", note: "Missing screenshot" })).success).toBe(true);
  });

  it.each([
    { submissionId: "nope", decision: "approved" },
    { submissionId: ID, decision: "pending" },
    { submissionId: ID, decision: "approved", note: "x".repeat(1001) },
  ] as Record<string, string>[])("rejects %j", (fields) => {
    expect(parseReviewForm(form(fields)).success).toBe(false);
  });
});

describe("parseRoleForm / parseAdjustForm", () => {
  it("accepts only user/admin roles", () => {
    expect(parseRoleForm(form({ userId: ID, role: "admin" })).success).toBe(true);
    expect(parseRoleForm(form({ userId: ID, role: "superadmin" })).success).toBe(false);
    expect(parseRoleForm(form({ userId: "x", role: "user" })).success).toBe(false);
  });

  it("validates coin adjustments", () => {
    expect(parseAdjustForm(form({ userId: ID, amount: "-10", reason: "Correction" }))).toEqual({
      success: true,
      data: { userId: ID, amount: -10, reason: "Correction" },
    });
    for (const amount of ["0", "1.5", "100001", "1e3", "", "abc"]) {
      expect(parseAdjustForm(form({ userId: ID, amount, reason: "Correction" })).success).toBe(false);
    }
    expect(parseAdjustForm(form({ userId: ID, amount: "5", reason: "no" })).success).toBe(false);
  });
});
