"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/admin/actions";
import type { TaskStatus } from "@/types/database";
import { ActionMessage } from "./action-message";

type Props = {
  status: TaskStatus;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

const initialState: ActionState = { status: "idle" };

/** Publish / archive / move-to-draft buttons. The server validates each transition. */
export function TaskStatusControls({ status, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const options: { to: TaskStatus; label: string; variant: "primary" | "secondary" | "danger" }[] = [
    ...(status !== "active" ? [{ to: "active" as const, label: "Publish", variant: "primary" as const }] : []),
    ...(status !== "draft" ? [{ to: "draft" as const, label: "Move to draft", variant: "secondary" as const }] : []),
    ...(status !== "archived" ? [{ to: "archived" as const, label: "Archive", variant: "danger" as const }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <ActionMessage state={state} />
      <div className="flex flex-wrap gap-3">
        {options.map((o) => (
          <form key={o.to} action={formAction}>
            <input type="hidden" name="status" value={o.to} />
            <Button type="submit" size="sm" variant={o.variant} disabled={pending}>
              {o.label}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
