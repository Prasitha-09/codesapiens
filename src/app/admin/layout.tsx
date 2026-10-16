import type { Metadata } from "next";
import { Suspense } from "react";
import { LegacyAdminHeader } from "@/components/admin/legacy-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageLoading, RequireAdmin } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Code Sapiens" },
  robots: { index: false, follow: false },
};

/**
 * The admin chrome renders only after a server-side role check (non-admins get
 * a 404). This is NOT the only guard: every admin page's data loader and every
 * admin action re-checks the role, and the database enforces it again.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RequireAdmin next="/admin">
        <LegacyAdminHeader><header className="border-b-[3px] border-ink bg-surface text-ink">
          <Container className="flex flex-col gap-4 py-8">
            <p className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-mint">Admin</p>
            <AdminNav />
          </Container>
        </header></LegacyAdminHeader>
        {children}
      </RequireAdmin>
    </Suspense>
  );
}
