"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea, fieldDescribedBy } from "@/components/ui/form";
import { submitTask, type SubmitState } from "@/lib/tasks/actions";
import { EVIDENCE_ACCEPT, EVIDENCE_MAX_BYTES } from "@/lib/tasks/evidence";

const initialState: SubmitState = { status: "idle" };

type SubmissionPanelProps = {
  taskId: string;
  evidenceRequired: boolean;
  /** Why the form is hidden (closed, already submitted…), as decided by the server. */
  blockedReason: string | null;
};

export function SubmissionPanel({ taskId, evidenceRequired, blockedReason }: SubmissionPanelProps) {
  const [state, formAction, pending] = useActionState(submitTask, initialState);
  const [fileError, setFileError] = useState<string | null>(null);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const evidenceError = fileError ?? errors?.evidence;
  const evidenceHint = `PNG, JPEG, WebP or PDF, up to 5 MB. Private: only you and admins can view it.`;

  // Shown after the server confirms the insert; the page re-renders with the
  // new pending submission and (correctly) no form.
  if (state.status === "submitted") {
    return (
      <Alert tone="success" title="Submission received" role="status">
        Your submission is now pending review. Track it on{" "}
        <Link href="/submissions" className="font-bold underline">
          My submissions
        </Link>
        .
      </Alert>
    );
  }

  if (blockedReason) {
    return <Alert tone="info">{blockedReason}</Alert>;
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (fileError) return;
        const formData = new FormData(e.currentTarget);
        // Submit via a transition so a failed attempt doesn't clear the fields.
        startTransition(() => formAction(formData));
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Submit your proof</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-5">
          {state.status === "error" && state.message && (
            <Alert tone="danger" role="alert">
              {state.message}
            </Alert>
          )}

          <input type="hidden" name="taskId" value={taskId} />

          <Field htmlFor="proofText" label="Notes" hint="Describe what you did." error={errors?.proofText}>
            <Textarea
              id="proofText"
              name="proofText"
              rows={4}
              maxLength={5000}
              aria-invalid={!!errors?.proofText}
              aria-describedby={fieldDescribedBy("proofText", { hint: "Describe what you did.", error: errors?.proofText })}
            />
          </Field>

          <Field htmlFor="proofUrl" label="Link (optional)" error={errors?.proofUrl}>
            <Input
              id="proofUrl"
              name="proofUrl"
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={2000}
              aria-invalid={!!errors?.proofUrl}
              aria-describedby={fieldDescribedBy("proofUrl", { error: errors?.proofUrl })}
            />
          </Field>

          <Field
            htmlFor="evidence"
            label={evidenceRequired ? "Evidence file" : "Evidence file (optional)"}
            hint={evidenceHint}
            error={evidenceError}
            required={evidenceRequired}
          >
            <input
              id="evidence"
              name="evidence"
              type="file"
              accept={EVIDENCE_ACCEPT}
              required={evidenceRequired}
              aria-invalid={!!evidenceError}
              aria-describedby={fieldDescribedBy("evidence", { hint: evidenceHint, error: evidenceError })}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                // Early feedback only; the server validates size and real file type.
                setFileError(file && file.size > EVIDENCE_MAX_BYTES ? "Files can be at most 5 MB." : null);
              }}
              className="block w-full cursor-pointer rounded-brutal border-[3px] border-ink bg-surface p-2 text-sm shadow-brutal-sm file:mr-3 file:cursor-pointer file:border-2 file:border-ink file:bg-mint file:text-on-accent file:px-3 file:py-1 file:font-bold"
            />
          </Field>
        </CardBody>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit for review"}
          </Button>
          {pending && <span className="text-sm text-subtle">Uploading and saving…</span>}
        </CardFooter>
      </Card>
    </form>
  );
}
