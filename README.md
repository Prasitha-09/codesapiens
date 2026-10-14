# TaskMint

A task and virtual-reward platform: users complete tasks, admins approve submissions, approved work earns virtual coins, and users climb a leaderboard and share a public QR profile.

Stack: Next.js 16 (App Router, `cacheComponents` enabled) · TypeScript · Tailwind CSS v4 · Supabase (Auth, Postgres, RLS) via `@supabase/ssr`.

## Status

| Area | Status |
| --- | --- |
| Scaffold, design system, layout, navigation | ✅ Done |
| Supabase SSR clients, session refresh (`src/proxy.ts`) | ✅ Done |
| Sign up, log in, log out, email confirmation route | ✅ Done |
| Protected routes (`/dashboard`, `/tasks` → signed in; `/admin` → admin role) | ✅ Done |
| Database: profiles, tasks, submissions, coin ledger, audit log, RLS | ✅ Migrations 1–5 applied · **migration 6 (coin rules, leaderboard) must be run manually** |
| Tasks: list, detail, submit proof (note/link/private file), submission history, deadline enforcement | ✅ Done |
| Admin: statistics, task create/edit/publish/archive, review queue, users (roles, coin adjustments), audit log | ✅ Done |
| Coins: ledger rules, balance vs lifetime earnings, wallet page, live leaderboard | ✅ Done (no spending — not in the plan) |
| Profiles: edit own profile, social links, public page `/u/<slug>`, QR code (PNG/SVG) | ✅ Done |
| Permission tests | ✅ `npm run test:db` (local) · SQL suite for the real project · `npm run test:api` |
| Tasks · Submissions · Coins · QR profiles · Leaderboard | ⏳ Not connected (placeholders say so) |

## Getting started

Requires Node.js 20.9+ (developed on Node 24).

```bash
npm install
cp .env.example .env.local   # then fill in the values — see "Supabase setup"
npm run dev                  # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run check` | Lint + typecheck |
| `npm test` | Unit tests (Vitest) + database permission suite |
| `npm run test:unit` | Unit tests: validation, social links, QR generation, app/DB agreement |
| `npm run test:db` | Migrations + permission suite in local in-memory Postgres |
| `npm run test:concurrency` | Real PostgreSQL server: simultaneous approvals/rejections of one submission |
| `npm run test:api` | Anonymous-access checks against the real Supabase API |

## Supabase setup

### 1. Environment variables (`.env.local`, project root)

`.env.local` lives next to `package.json` and is gitignored. Restart `npm run dev` after editing it.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key or legacy anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Find them in the Supabase dashboard → **Project Settings → API** (URL) and **API Keys** (publishable / `anon` key).
These two keys are safe in the browser; RLS protects the data.
**Never** put the `service_role` / secret key in this project — TaskMint doesn't need it.

### 2. Run the database migrations

Dashboard → **SQL Editor** → New query → paste each file in `supabase/migrations/` **in filename order** → **Run**. Run each once.
Then verify with the permission tests — see [docs/database-security.md](docs/database-security.md).

### 3. Auth URL configuration

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (your production URL later)
- **Redirect URLs**: add `http://localhost:3000/auth/confirm` (and the production equivalent later)

### 4. (Recommended) Confirmation email template

The default email link only works if opened in the same browser that signed up. To make it work on any device,
go to **Authentication → Email Templates → Confirm signup** and use this link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard">Confirm your email</a>
```

### 5. Make yourself an admin

Sign up and confirm your email, then in the SQL Editor:

```sql
update public.profiles set role = 'admin' where username = 'your_username';
```

Roles can only be changed with SQL (or a future admin-only function) — never from the app.

### Accounts created before the migration

They have no profile row. Backfill once:

```sql
insert into public.profiles (id, username, display_name)
select u.id, 'user_' || substr(replace(u.id::text, '-', ''), 1, 10), 'user_' || substr(replace(u.id::text, '-', ''), 1, 10)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
```

## How auth works

| Layer | File | Role |
| --- | --- | --- |
| Proxy | `src/proxy.ts`, `src/lib/supabase/proxy.ts` | Refreshes the session cookie on every request; redirects signed-out users from protected paths. Optimistic only. |
| Data access layer | `src/lib/auth/session.ts` | `getCurrentUser()` (verifies the JWT with `getClaims()`), `requireUser()`, `requireAdmin()` (role read from the database; fails closed → 404). |
| Server Actions | `src/lib/auth/actions.ts` | `signUp`, `signIn`, `signOut` with zod validation and safe error messages. |
| Email links | `src/app/auth/confirm/route.ts` | Handles `token_hash` and PKCE `code` links. |
| Database | `supabase/migrations/` | RLS + column privileges; users can't change their own `role`. |

`?next=` redirects are restricted to same-site paths (`safeNextPath`) to prevent open redirects.

## Project structure

```
src/
├─ app/
│  ├─ page.tsx                       landing page
│  ├─ (marketing)/styleguide         design-system showcase (noindex)
│  ├─ (auth)/login, signup           auth forms
│  ├─ (user)/dashboard, tasks        signed-in pages
│  ├─ (user)/leaderboard             public placeholder
│  ├─ admin/                         admin-only
│  └─ auth/confirm/route.ts          email-link handler
├─ components/{ui,layout,auth}/
├─ config/site.ts                    site name and navigation
├─ lib/
│  ├─ supabase/{client,server,proxy,env}.ts
│  └─ auth/{session,actions,routes,validation}.ts
├─ proxy.ts
└─ types/database.ts                 hand-written; replace with generated types later
supabase/migrations/                 SQL to run in the Supabase SQL Editor
```

## Design system

New Brutalist: thick ink borders, hard offset shadows, flat high-contrast colors, Space Grotesk + Space Mono.
Tokens live in `src/app/globals.css` (`@theme`); browse every component at `/styleguide`.

## Notes

- Supabase's built-in email sender is heavily rate-limited (a few emails per hour). Configure custom SMTP before real use.
- TaskMint coins are virtual points with no cash value.
