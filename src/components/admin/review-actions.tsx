"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea, fieldDescribedBy } from "@/components/ui/form";
import { reviewSubmission, type ActionState } from "@/lib/admin/actions";
import { ActionMessage } from "./action-message";

const initialState: ActionState = { status: "idle" };

/**
 * Approve / reject controls. Buttons disable while a request is in flight so a
 * double click sends one request; if two requests still race (two tabs, two
 * admins), the database's row lock lets exactly one win and the other gets a
 * clear "already reviewed" message.
 */
export function ReviewActions({ submissionId }: { submissionId: string }) {
  const [state, formAction, pending] = useActionState(reviewSubmission, initialState);
  const [rejecting, setRejecting] = useState(false);
  const noteError = state.status === "error" ? state.fieldErrors?.note : undefined;
  const noteId = `note-${submissionId}`;

  return (
    <div className="flex flex-col gap-3">
      <ActionMessage state={state} />
      {!rejecting ? (
        <div className="flex flex-wrap gap-3">
          <form action={formAction}>
            <input type="hidden" name="submissionId" value={submissionId} />
            <input type="hidden" name="decision" value="approved" />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Approve"}
            </Button>
          </form>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => setRejecting(true)}>
            Reject…
          </Button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="submissionId" value={submissionId} />
          <input type="hidden" name="decision" value="rejected" />
          <Field htmlFor={noteId} label="Reason for rejection" error={noteError} required>
            <Textarea
              id={noteId}
              name="note"
              rows={3}
              minLength={3}
              maxLength={1000}
              required
              placeholder="Tell the user what was missing."
              aria-invalid={!!noteError}
              aria-describedby={fieldDescribedBy(noteId, { error: noteError })}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm" variant="danger" disabled={pending}>
              {pending ? "Saving…" : "Confirm rejection"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
