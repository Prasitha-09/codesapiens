"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, fieldDescribedBy } from "@/components/ui/form";
import { signUp, type SignUpState } from "@/lib/auth/actions";

const initialState: SignUpState = { status: "idle" };

const hints = {
  username: "3–20 characters: lowercase letters, numbers and underscores. Shown publicly.",
  password: "At least 8 characters.",
};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  if (state.status === "check-email") {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success" title="Check your email">
          If <strong>{state.email}</strong> can be registered, we&apos;ve sent a confirmation link to it. Open the link
          to activate your account, then log in.
        </Alert>
        <p className="text-sm text-subtle">
          Didn&apos;t get it? Check your spam folder. Confirmation emails can take a few minutes.
        </p>
        <Link href="/login" className="font-bold underline underline-offset-4">
          Go to login
        </Link>
      </div>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && state.message && (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      )}

      <Field htmlFor="username" label="Username" hint={hints.username} error={errors?.username} required>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={20}
          defaultValue={values?.username}
          aria-invalid={!!errors?.username}
          aria-describedby={fieldDescribedBy("username", { hint: hints.username, error: errors?.username })}
        />
      </Field>

      <Field htmlFor="email" label="Email" error={errors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={values?.email}
          aria-invalid={!!errors?.email}
          aria-describedby={fieldDescribedBy("email", { error: errors?.email })}
        />
      </Field>

      <Field htmlFor="password" label="Password" hint={hints.password} error={errors?.password} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          aria-invalid={!!errors?.password}
          aria-describedby={fieldDescribedBy("password", { hint: hints.password, error: errors?.password })}
        />
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-bold underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
