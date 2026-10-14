import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdjustCoinsForm, RoleControl } from "@/components/admin/user-actions";
import { PageLoading } from "@/components/auth/gates";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { H1 } from "@/components/ui/typography";
import { USERS_PAGE_SIZE, listUsers } from "@/lib/admin/data";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDeadline } from "@/lib/tasks/deadline";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <H1 className="text-3xl sm:text-4xl">Users</H1>
      <Suspense fallback={<PageLoading />}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Directory({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.slice(0, 100) : "";
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const [result, me] = await Promise.all([listUsers(search, page), getCurrentUser()]);

  const pageHref = (p: number) => `/admin/users?${new URLSearchParams({ ...(search && { q: search }), page: String(p) })}`;

  return (
    <div className="flex flex-col gap-6">
      <form role="search" className="flex max-w-xl gap-3">
        <label htmlFor="q" className="sr-only">
          Search users
        </label>
        <Input id="q" name="q" defaultValue={search} placeholder="Search username, name or email" maxLength={100} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {!result.ok ? (
        <Alert tone={result.schemaMissing ? "warning" : "danger"} title="Users unavailable">
          {result.schemaMissing
            ? "The database is missing the admin functions. Apply migration 5 (see the README)."
            : "We couldn't load users. Please refresh the page."}
        </Alert>
      ) : result.data.users.length === 0 ? (
        <Alert tone="info">No users match &ldquo;{search}&rdquo;.</Alert>
      ) : (
        <>
          <p className="text-sm text-subtle">
            {result.data.total} user{result.data.total === 1 ? "" : "s"}
            {search && <> matching &ldquo;{search}&rdquo;</>}
          </p>
          <ul className="flex list-none flex-col gap-4">
            {result.data.users.map((u) => {
              const self = u.id === me?.id;
              return (
                <li key={u.id}>
                  <Card>
                    <CardBody className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-bold">@{u.username}</span>
                          <Badge tone={u.role === "admin" ? "ink" : "neutral"}>{u.role}</Badge>
                          {!u.is_public && <Badge tone="sun">private</Badge>}
                          {self && <Badge tone="sky">you</Badge>}
                        </div>
                        {u.display_name && <p>{u.display_name}</p>}
                        <p className="break-all font-mono text-xs">{u.email ?? "—"}</p>
                        <dl className="grid grid-cols-3 gap-2 pt-1 text-sm">
                          <div>
                            <dt className="font-mono text-xs uppercase text-subtle">Coins</dt>
                            <dd className="font-bold">{Number(u.coins).toLocaleString("en")}</dd>
                          </div>
                          <div>
                            <dt className="font-mono text-xs uppercase text-subtle">Submitted</dt>
                            <dd className="font-bold">{u.submissions}</dd>
                          </div>
                          <div>
                            <dt className="font-mono text-xs uppercase text-subtle">Approved</dt>
                            <dd className="font-bold">{u.approved}</dd>
                          </div>
                        </dl>
                        <p className="font-mono text-xs text-subtle">
                          Joined {formatDeadline(u.created_at)}
                          {u.last_sign_in_at && ` · last sign-in ${formatDeadline(u.last_sign_in_at)}`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-4 border-t-[3px] border-dashed border-ink/30 pt-4 lg:border-l-[3px] lg:border-t-0 lg:pl-5 lg:pt-0">
                        {self ? (
                          <p className="text-sm text-subtle">
                            You can&apos;t change your own role or balance. Ask another admin.
                          </p>
                        ) : (
                          <>
                            <RoleControl userId={u.id} role={u.role} username={u.username} />
                            <AdjustCoinsForm userId={u.id} />
                          </>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
          <nav aria-label="Pages" className="flex gap-3">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className={buttonStyles({ size: "sm", variant: "secondary" })}>
                ← Previous
              </Link>
            )}
            {page * USERS_PAGE_SIZE < result.data.total && (
              <Link href={pageHref(page + 1)} className={buttonStyles({ size: "sm", variant: "secondary" })}>
                Next →
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
