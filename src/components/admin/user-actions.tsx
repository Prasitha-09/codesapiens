"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, fieldDescribedBy } from "@/components/ui/form";
import { adjustCoins, changeUserRole, type ActionState } from "@/lib/admin/actions";
import type { UserRole } from "@/types/database";
import { ActionMessage } from "./action-message";

const initialState: ActionState = { status: "idle" };

export function RoleControl({ userId, role, username }: { userId: string; role: UserRole; username: string }) {
  const [state, formAction, pending] = useActionState(changeUserRole, initialState);
  const next: UserRole = role === "admin" ? "user" : "admin";
  return (
    <div className="flex flex-col gap-2">
      <ActionMessage state={state} />
      <form
        action={formAction}
        onSubmit={(e) => {
          const verb = next === "admin" ? `Give @${username} full admin access?` : `Remove admin access from @${username}?`;
          if (!window.confirm(verb)) e.preventDefault();
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="role" value={next} />
        <Button type="submit" size="sm" variant={next === "admin" ? "accent" : "secondary"} disabled={pending}>
          {pending ? "Saving…" : next === "admin" ? "Make admin" : "Remove admin"}
        </Button>
      </form>
    </div>
  );
}

export function AdjustCoinsForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(adjustCoins, initialState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const amountId = `amount-${userId}`;
  const reasonId = `reason-${userId}`;
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <ActionMessage state={state} />
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field htmlFor={amountId} label="Amount" error={errors?.amount}>
          <Input
            id={amountId}
            name="amount"
            type="number"
            step={1}
            placeholder="e.g. 25 or -10"
            required
            aria-invalid={!!errors?.amount}
            aria-describedby={fieldDescribedBy(amountId, { error: errors?.amount })}
          />
        </Field>
        <Field htmlFor={reasonId} label="Reason (recorded in the audit log)" error={errors?.reason}>
          <Input
            id={reasonId}
            name="reason"
            minLength={3}
            maxLength={500}
            required
            aria-invalid={!!errors?.reason}
            aria-describedby={fieldDescribedBy(reasonId, { error: errors?.reason })}
          />
        </Field>
      </div>
      <div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Adjust coins"}
        </Button>
      </div>
    </form>
  );
}
