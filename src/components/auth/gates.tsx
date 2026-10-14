import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { requireAdmin, requireUser } from "@/lib/auth/session";

/**
 * Server-side guards. `children` are only rendered (and their data only fetched)
 * after the check passes. Place inside a <Suspense> boundary: the check reads
 * the request's cookies.
 */
export async function RequireUser({ next, children }: { next: string; children: ReactNode }) {
  await requireUser(next);
  return <>{children}</>;
}

export async function RequireAdmin({ next, children }: { next: string; children: ReactNode }) {
  await requireAdmin(next);
  return <>{children}</>;
}

export function PageLoading() {
  return (
    <Container className="py-12" aria-busy="true">
      <p className="sr-only">Loading…</p>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-4">
        <div className="h-24 rounded-brutal border-[3px] border-ink/20 bg-muted" />
        <div className="h-40 rounded-brutal border-[3px] border-ink/20 bg-muted" />
      </div>
    </Container>
  );
}
