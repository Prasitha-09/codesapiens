import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthCard eyebrow="Join the arena" title="Create account" description="Take on challenges, earn coins and climb the leaderboard.">
      <SignupForm />
    </AuthCard>
  );
}
