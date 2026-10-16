# SAPIENS CAMPUS — Live Quiz Arena

A persistent, team-based college quiz with Supabase authentication, private question keys, transactional scoring, a public live leaderboard, and an organizer control room. The existing challenge-and-coins application remains available.

**Start here: [Quiz setup, event workflow, security, and tests](docs/live-quiz.md).** Configure `.env.local`, apply the migrations, enable anonymous sign-ins, and provision the first admin. Then run `npm run dev`.

Quiz routes: `/`, `/join`, `/quiz`, `/leaderboard`, `/admin/login`, and the `/admin` organizer pages. Original entry points: `/challenges`, `/challenge-leaderboard`, `/admin/challenges`, `/admin/review`.

---

# Code Sapiens — The Challenge Arena

The event platform for **Code Sapiens**: participants take on challenges, submit their work, earn coins when an organizer approves it, and compete on a live leaderboard.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · Supabase (Auth, Postgres with Row Level Security, Storage) via `@supabase/ssr`.

## Features

| Area | What it does |
| --- | --- |
| Accounts | Sign up, log in, log out, email confirmation; sessions refreshed by `src/proxy.ts` |
| Challenges | Browse open challenges with reward, deadline and submission requirements; submit notes, a link or a private evidence file |
| My Attempts | Every submission with its status (pending / approved / rejected) and the reviewer's reason |
| Coins | Append-only ledger; spendable balance and lifetime earnings; rewards paid exactly once per approved submission |
| Leaderboard | Public profiles ranked live by lifetime coins earned; ties share a rank |
| Profiles | Editable profile, social links, public page `/u/<code>` and a downloadable QR code (PNG/SVG) |
| Admin | Statistics, challenge create/edit/publish/archive, review queue with rejection reasons, user roles, coin adjustments, audit log |

Every rule (roles, deadlines, rewards, private evidence) is enforced in the database with RLS policies and `SECURITY DEFINER` functions, not only in the UI. See [docs/database-security.md](docs/database-security.md).

## Getting started

Requires Node.js 20.9+ (developed on Node 24) and a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in the values — see "Supabase setup"
npm run dev                  # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run check` | Lint + type check |
| `npm test` | Unit tests (Vitest) + database permission suite |
| `npm run test:unit` | Unit tests only |
| `npm run test:db` | Applies all migrations to an in-memory Postgres and runs the permission suite |
| `npm run test:concurrency` | Real PostgreSQL server: simultaneous approvals and balance changes |
| `npm run test:api` | Anonymous-access checks against your Supabase project (needs `.env.local`) |
| `npm run screenshots` | Screenshots of public pages at desktop/tablet/mobile widths (needs `npm run dev` and a local Chrome or Edge) |

## Supabase setup

### 1. Environment variables

Create `.env.local` next to `package.json` (it is git-ignored) and restart `npm run dev` after editing it:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key or legacy anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Find the URL and key in the Supabase dashboard under **Project Settings → API**. Both are designed to be public; RLS protects the data.
**Never** add the `service_role` / secret key — the app doesn't use it.

### 2. Database migrations

Supabase dashboard → **SQL Editor** → New query → paste each file from `supabase/migrations/` **in filename order** → **Run** (once each).
Then run `supabase/tests/permissions_test.sql` the same way; it reports `SUMMARY: N of N tests passed` and rolls back all test data.

Optional, development only: `supabase/seed/dev_tasks.sql` inserts sample challenges.

### 3. Auth URLs

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (your production URL when deployed)
- **Redirect URLs**: `http://localhost:3000/auth/confirm` (plus the production equivalent)

Recommended — **Authentication → Email Templates → Confirm signup**, so the link works on any device:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard">Confirm your email</a>
```

### 4. First admin

Sign up, confirm your email, then in the SQL Editor:

```sql
update public.profiles set role = 'admin' where username = 'your_username';
```

After that, admins manage roles from **Admin → Users**. Nobody can grant themselves admin from the app.

## Deploying

Set the three variables above in your host (e.g. Vercel → Settings → Environment Variables), with `NEXT_PUBLIC_SITE_URL` set to the real `https://` address — QR codes encode it. Redeploy after changing `NEXT_PUBLIC_*` values, and add the production URLs in Supabase **URL Configuration**.

Supabase's built-in email sender is heavily rate-limited; configure custom SMTP before the event.

## Project structure

```
src/
├─ app/
│  ├─ page.tsx                     landing page
│  ├─ (auth)/login, signup         account forms
│  ├─ (user)/dashboard             My Arena
│  ├─ (user)/tasks, tasks/[id]     Challenges
│  ├─ (user)/submissions           My Attempts (+ private evidence links)
│  ├─ (user)/wallet                My Coins
│  ├─ (user)/profile, profile/qr   My Profile and QR download
│  ├─ (user)/leaderboard           public leaderboard
│  ├─ u/[slug]                     public profile
│  ├─ admin/                       admin dashboard (server-checked role)
│  └─ auth/confirm/route.ts        email-link handler
├─ components/                     ui/, layout/, landing/, tasks/, coins/, profile/, admin/, auth/
├─ config/site.ts                  brand and navigation
├─ lib/                            supabase/, auth/, tasks/, coins/, profile/, admin/
├─ proxy.ts                        session refresh + optimistic redirects
└─ types/database.ts
supabase/
├─ migrations/                     database schema, RLS and functions (run in order)
├─ seed/                           optional development data
└─ tests/permissions_test.sql      permission suite for a real project
tests/                             unit, database, concurrency and API tests
docs/database-security.md          security model and coin rules
```

## Design system

Neo-Brutalist, dark: charcoal surfaces, off-white thick borders, hard offset shadows, acid-lime highlights with electric blue and violet accents. Anton for display headings, Space Grotesk for body text, Space Mono for labels. Tokens live in `src/app/globals.css`; every component is shown at `/styleguide`.

## Notes

- Coins are virtual points with no cash value.
- Licensed under the [MIT License](LICENSE).
