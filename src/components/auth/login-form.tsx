"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, fieldDescribedBy } from "@/components/ui/form";
import { signIn, type SignInState } from "@/lib/auth/actions";

const initialState: SignInState = { status: "idle" };

const notices: Record<string, { tone: "success" | "danger" | "info"; text: string }> = {
  signed_out: { tone: "success", text: "You've been logged out." },
  confirm: { tone: "danger", text: "That confirmation link is invalid or has expired. Try logging in, or sign up again." },
};

export function LoginForm({ admin = false }: { admin?: boolean }) {
  const searchParams = useSearchParams();
  const next = admin ? "/admin" : searchParams.get("next") ?? "";
  const notice = searchParams.get("error")
    ? notices[searchParams.get("error") as string]
    : searchParams.has("signed_out")
      ? notices.signed_out
      : searchParams.has("next")
        ? { tone: "info" as const, text: "Please log in to continue." }
        : undefined;

  const [state, formAction, pending] = useActionState(signIn, initialState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {notice && state.status === "idle" && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {state.status === "error" && state.message && (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      )}

      <input type="hidden" name="next" value={next} />

      <Field htmlFor="email" label="Email" error={errors?.email}>
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

      <Field htmlFor="password" label="Password" error={errors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!errors?.password}
          aria-describedby={fieldDescribedBy("password", { error: errors?.password })}
        />
      </Field>

      <Button type="submit" size="lg" block className={admin ? "quiz-button" : undefined} disabled={pending || (admin && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY))}>
        {pending ? "Logging in…" : "Log in"}
      </Button>

      {!admin && <p className="text-center text-sm">
        New to the arena?{" "}
        <Link href="/signup" className="font-bold underline underline-offset-4">
          Create an account
        </Link>
      </p>}
    </form>
  );
}
