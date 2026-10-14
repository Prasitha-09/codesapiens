// Every admin Server Action must re-check the caller's admin role on the server
// and refuse BEFORE touching the database — regardless of what the page showed.
// Here the session layer reports "not an admin" and the database client factory
// is a spy that must never be called.

import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const getAdminOrNull = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/auth/session", () => ({ getAdminOrNull }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect should not be reached");
  }),
}));

const { adjustCoins, changeUserRole, createTask, reviewSubmission, setTaskStatus, updateTask } = await import(
  "@/lib/admin/actions"
);

const ID = "3f0c7a52-8a5e-4c1e-9d2f-1a2b3c4d5e6f";
const idle = { status: "idle" } as const;

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// Inputs that would otherwise be valid, so only authorization can stop them.
const calls: [string, () => Promise<unknown>][] = [
  [
    "createTask",
    () =>
      createTask(idle, form({ title: "Valid title", description: "x", reward_coins: "5", status: "draft", deadline: "" })),
  ],
  [
    "updateTask",
    () =>
      updateTask(ID, idle, form({ title: "Valid title", description: "x", reward_coins: "5", status: "draft", deadline: "" })),
  ],
  ["setTaskStatus", () => setTaskStatus(ID, idle, form({ status: "active" }))],
  ["reviewSubmission (approve)", () => reviewSubmission(idle, form({ submissionId: ID, decision: "approved" }))],
  [
    "reviewSubmission (reject)",
    () => reviewSubmission(idle, form({ submissionId: ID, decision: "rejected", note: "Not enough" })),
  ],
  ["changeUserRole (self-promotion attempt)", () => changeUserRole(idle, form({ userId: ID, role: "admin" }))],
  ["adjustCoins", () => adjustCoins(idle, form({ userId: ID, amount: "1000", reason: "free coins" }))],
];

describe("admin actions refuse non-admins before any database access", () => {
  beforeEach(() => {
    createClient.mockReset();
    getAdminOrNull.mockReset();
    getAdminOrNull.mockResolvedValue(null); // signed-out or ordinary user
  });

  it.each(calls)("%s", async (_name, call) => {
    await expect(call()).resolves.toEqual({ status: "error", message: "You don't have permission to do that." });
    expect(getAdminOrNull).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("admins cannot change their own role or balance (checked before the database)", () => {
  beforeEach(() => {
    createClient.mockReset();
    getAdminOrNull.mockReset();
    getAdminOrNull.mockResolvedValue({ user: { id: ID, email: null }, profile: { id: ID, role: "admin" } });
  });

  it("own role", async () => {
    await expect(changeUserRole(idle, form({ userId: ID, role: "user" }))).resolves.toMatchObject({
      status: "error",
      message: "You cannot change your own role.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("own balance", async () => {
    await expect(adjustCoins(idle, form({ userId: ID, amount: "50", reason: "bonus" }))).resolves.toMatchObject({
      status: "error",
      message: "You cannot adjust your own balance.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});
