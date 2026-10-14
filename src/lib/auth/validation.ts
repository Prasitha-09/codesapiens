import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

/** Same rule as the `profiles.username` CHECK constraint. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "3–20 characters: lowercase letters, numbers and underscores.");

export const signUpSchema = z.object({
  username: usernameSchema,
  email,
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    // bcrypt (used by Supabase Auth) ignores bytes beyond 72.
    .max(72, "Use 72 characters or fewer."),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
