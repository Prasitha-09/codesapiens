import { describe, expect, it } from "vitest";
import { parseSubmissionFields } from "@/lib/tasks/validation";

const TASK = "3f0c7a52-8a5e-4c1e-9d2f-1a2b3c4d5e6f";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseSubmissionFields (server-side validation)", () => {
  it("accepts and normalizes valid input", () => {
    expect(parseSubmissionFields(form({ taskId: TASK, proofText: "  Done it  ", proofUrl: "https://example.com" }))).toEqual({
      success: true,
      data: { taskId: TASK, proofText: "Done it", proofUrl: "https://example.com/" },
    });
  });

  it("turns empty fields into null", () => {
    const result = parseSubmissionFields(form({ taskId: TASK, proofText: "   ", proofUrl: "" }));
    expect(result).toEqual({ success: true, data: { taskId: TASK, proofText: null, proofUrl: null } });
  });

  it.each(["", "not-a-uuid", "1; drop table tasks", "../admin"])("rejects task id %j", (taskId) => {
    const result = parseSubmissionFields(form({ taskId, proofText: "x" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.taskId).toBeDefined();
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "ftp://example.com", "example.com", "https://u:p@example.com"])(
    "rejects proof link %j",
    (proofUrl) => {
      const result = parseSubmissionFields(form({ taskId: TASK, proofUrl }));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.fieldErrors.proofUrl).toBeDefined();
    },
  );

  it("rejects notes over 5000 characters", () => {
    const result = parseSubmissionFields(form({ taskId: TASK, proofText: "a".repeat(5001) }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.proofText).toMatch(/5000/);
  });

  it("ignores client-supplied user id, reward, deadline and status", () => {
    const result = parseSubmissionFields(
      form({
        taskId: TASK,
        proofText: "x",
        user_id: "00000000-0000-0000-0000-000000000000",
        reward_coins: "99999",
        deadline: "2999-01-01",
        status: "approved",
      }),
    );
    expect(result.success && Object.keys(result.data).sort()).toEqual(["proofText", "proofUrl", "taskId"]);
  });
});
