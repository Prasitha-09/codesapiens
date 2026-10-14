"use client";

import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea, fieldDescribedBy } from "@/components/ui/form";
import type { ActionState } from "@/lib/admin/actions";
import { ActionMessage } from "./action-message";

export type TaskFormValues = {
  title: string;
  description: string;
  requirements: string;
  reward_coins: string;
  deadline: string; // datetime-local, UTC
  evidence_required: boolean;
  status: "draft" | "active" | "archived";
};

type TaskFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: TaskFormValues;
  submitLabel: string;
};

const initialState: ActionState = { status: "idle" };

export function TaskForm({ action, initial, submitLabel }: TaskFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const deadlineHint = "Optional. Enter the time in UTC. Submissions are refused after this moment.";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // Via a transition so a failed save keeps what the admin typed.
        startTransition(() => formAction(formData));
      }}
    >
      <Card>
        <CardBody className="flex flex-col gap-5">
          <ActionMessage state={state} />

          <Field htmlFor="title" label="Title" error={errors?.title} required>
            <Input
              id="title"
              name="title"
              defaultValue={initial.title}
              maxLength={120}
              required
              aria-invalid={!!errors?.title}
              aria-describedby={fieldDescribedBy("title", { error: errors?.title })}
            />
          </Field>

          <Field htmlFor="description" label="Description" error={errors?.description} required>
            <Textarea
              id="description"
              name="description"
              defaultValue={initial.description}
              rows={5}
              maxLength={5000}
              required
              aria-invalid={!!errors?.description}
              aria-describedby={fieldDescribedBy("description", { error: errors?.description })}
            />
          </Field>

          <Field
            htmlFor="requirements"
            label="Submission requirements"
            hint="What proof should users provide? Optional."
            error={errors?.requirements}
          >
            <Textarea
              id="requirements"
              name="requirements"
              defaultValue={initial.requirements}
              rows={3}
              maxLength={2000}
              aria-invalid={!!errors?.requirements}
              aria-describedby={fieldDescribedBy("requirements", {
                hint: "What proof should users provide? Optional.",
                error: errors?.requirements,
              })}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field htmlFor="reward_coins" label="Reward (coins)" error={errors?.reward_coins} required>
              <Input
                id="reward_coins"
                name="reward_coins"
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                step={1}
                defaultValue={initial.reward_coins}
                required
                aria-invalid={!!errors?.reward_coins}
                aria-describedby={fieldDescribedBy("reward_coins", { error: errors?.reward_coins })}
              />
            </Field>

            <Field htmlFor="status" label="Status" error={errors?.status} required>
              <Select id="status" name="status" defaultValue={initial.status} aria-invalid={!!errors?.status}>
                <option value="draft">Draft (hidden from users)</option>
                <option value="active">Active (published)</option>
                <option value="archived">Archived (closed)</option>
              </Select>
            </Field>
          </div>

          <Field htmlFor="deadline" label="Deadline (UTC)" hint={deadlineHint} error={errors?.deadline}>
            <Input
              id="deadline"
              name="deadline"
              type="datetime-local"
              defaultValue={initial.deadline}
              aria-invalid={!!errors?.deadline}
              aria-describedby={fieldDescribedBy("deadline", { hint: deadlineHint, error: errors?.deadline })}
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="evidence_required"
              defaultChecked={initial.evidence_required}
              className="mt-1 size-5 shrink-0 cursor-pointer accent-mint"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-bold">Require an evidence file</span>
              <span className="text-sm text-subtle">Users must upload a private image or PDF to submit.</span>
            </span>
          </label>
        </CardBody>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
