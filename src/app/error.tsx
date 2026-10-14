"use client";

import { useEffect } from "react";
import { Container } from "@/components/layout/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { H1, Lead } from "@/components/ui/typography";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex flex-1 flex-col items-start justify-center gap-6 py-20">
      <span className="border-[3px] border-ink bg-danger px-3 py-1 font-mono font-bold text-on-accent shadow-brutal">Error</span>
      <H1>Something went wrong</H1>
      {/* Never show raw error messages to users; they can leak internals. */}
      <Lead>An unexpected error occurred. Please try again.</Lead>
      {error.digest && <p className="font-mono text-sm text-subtle">Reference: {error.digest}</p>}
      <div className="flex flex-wrap gap-4">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </Container>
  );
}
