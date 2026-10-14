"use client";

import { startTransition, useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea, fieldDescribedBy } from "@/components/ui/form";
import { updateProfile, type UpdateProfileState } from "@/lib/profile/actions";
import { SOCIAL_PLATFORMS, type SocialLinks } from "@/lib/profile/social-links";

const initialState: UpdateProfileState = { status: "idle" };

type ProfileFormProps = {
  initial: {
    username: string;
    displayName: string;
    bio: string;
    isPublic: boolean;
    socialLinks: SocialLinks;
  };
};

const usernameHint = "3–20 characters: lowercase letters, numbers and underscores.";

export function ProfileForm({ initial }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    // Submitting via a transition (instead of the `action` prop) stops React from
    // resetting the fields, so a failed save keeps what the user typed. After a
    // successful save the fields remount with the saved (normalized) values.
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <Card key={state.status === "saved" ? state.savedAt : "initial"}>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-5">
          {state.status === "saved" && (
            <Alert tone="success" role="status" key={state.savedAt}>
              Profile saved.
            </Alert>
          )}
          {state.status === "error" && state.message && (
            <Alert tone="danger" role="alert">
              {state.message}
            </Alert>
          )}

          <Field htmlFor="username" label="Username" hint={usernameHint} error={errors?.username} required>
            <Input
              id="username"
              name="username"
              defaultValue={initial.username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={20}
              aria-invalid={!!errors?.username}
              aria-describedby={fieldDescribedBy("username", { hint: usernameHint, error: errors?.username })}
            />
          </Field>

          <Field htmlFor="displayName" label="Display name" error={errors?.displayName}>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={initial.displayName}
              maxLength={50}
              autoComplete="name"
              aria-invalid={!!errors?.displayName}
              aria-describedby={fieldDescribedBy("displayName", { error: errors?.displayName })}
            />
          </Field>

          <Field htmlFor="bio" label="Bio" hint="Up to 280 characters." error={errors?.bio}>
            <Textarea
              id="bio"
              name="bio"
              defaultValue={initial.bio}
              maxLength={280}
              rows={3}
              aria-invalid={!!errors?.bio}
              aria-describedby={fieldDescribedBy("bio", { hint: "Up to 280 characters.", error: errors?.bio })}
            />
          </Field>

          <fieldset className="flex flex-col gap-4 border-t-[3px] border-dashed border-ink/30 pt-5">
            <legend className="sr-only">Social links</legend>
            <p aria-hidden="true" className="text-sm font-bold uppercase tracking-wide">
              Social links
            </p>
            <p className="-mt-2 text-sm text-subtle">Optional. Shown on your public profile. Must be https links.</p>
            {SOCIAL_PLATFORMS.map((p) => {
              const id = `social.${p.id}`;
              const error = errors?.[id];
              return (
                <Field key={p.id} htmlFor={id} label={p.label} error={error}>
                  <Input
                    id={id}
                    name={id}
                    type="url"
                    inputMode="url"
                    placeholder={p.example}
                    defaultValue={initial.socialLinks[p.id] ?? ""}
                    maxLength={300}
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={!!error}
                    aria-describedby={fieldDescribedBy(id, { error })}
                  />
                </Field>
              );
            })}
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 border-t-[3px] border-dashed border-ink/30 pt-5">
            <input
              type="checkbox"
              name="isPublic"
              defaultChecked={initial.isPublic}
              className="mt-1 size-5 shrink-0 cursor-pointer accent-mint"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-bold">Public profile</span>
              <span className="text-sm text-subtle">
                When off, your public page and QR code show &ldquo;not found&rdquo; and you&apos;re hidden from the
                leaderboard.
              </span>
            </span>
          </label>
        </CardBody>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
