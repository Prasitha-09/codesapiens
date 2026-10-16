# SAPIENS CAMPUS — Live Quiz Arena

The quiz extends the existing challenge app. Public routes are `/`, `/join`, `/quiz`, and `/leaderboard`. Organizer routes are `/admin/login`, `/admin`, `/admin/teams`, `/admin/rounds`, `/admin/questions`, `/admin/submissions`, `/admin/scores`, and `/admin/settings`.

## Connect a Supabase project

1. Install dependencies with `npm install`. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`. No service-role or secret key is required or permitted in browser code.
2. Apply every file in `supabase/migrations` in filename order. Existing installations apply only the new `20261016000007_live_quiz.sql` migration after their six existing migrations. Migration scripts are intended to run once through Supabase migrations or the SQL Editor.
3. Enable **Authentication → Providers → Anonymous Sign-Ins**. Participants get a Supabase Auth session when they join, without email registration. Their database membership survives refresh through the session cookie. An existing signed-in account can also join. Clearing cookies or changing devices loses access to an anonymous identity; organizers can register a replacement and assign it to the original team, which still retains its one-answer constraint. Configure Supabase Auth rate limits for the event. If your project requires CAPTCHA, add your site's CAPTCHA token flow before anonymous sign-in; the current form does not integrate a CAPTCHA widget.
4. Create the first organizer account through the existing ordinary `/signup` flow, confirm its email, and grant the role once in the trusted SQL Editor: `update public.profiles set role = 'admin' where username = 'your_username';`. Public signup always creates a non-admin. No public admin registration exists. Use `/admin/login` afterward.
5. Set Supabase Auth Site URL and redirect allow-list to your deployment and `/auth/confirm`. Preserve the existing confirmation template described in the README.
6. The migration adds **only `quiz_signal`** to `supabase_realtime` when that publication exists (as it does in Supabase). Verify this table is enabled in Realtime. Its RLS allows public reads of event IDs and timestamps only. Private tables must stay out of the publication. The browser subscribes to this safe invalidation table and re-fetches an allow-listed state RPC; a five-second poll also reconnects missed updates.
7. Run `npm run dev`. Production: `npm run build`, then `npm start`. Fonts use local system stacks, so builds do not depend on Google Fonts. Deploy with the same environment values and HTTPS.

## Run an event

- Create an event in `/admin`. The three default rounds are created with 5, 10, and 20 points.
- Add teams with colors and capacities. Add/edit/reorder rounds and questions while the event is in the lobby. Questions support 2–6 multiple-choice options or a short answer. For MCQ the private key must exactly match an option. Short answers are manually reviewed against the private key.
- Share the join code and `/join`. Participants can pick an available team or be assigned automatically. The first member is captain. In Teams, move participants or choose a captain. Moving a captain leaves that team's captain vacant; explicitly appoint the replacement. Settings can allow any team member to submit instead, with the first submitted answer remaining official.
- Start the event. Publish the first question, then open submissions. Publishing any next question or round closes submissions automatically. Question order follows round order and then question order. Use the question lineup to advance. Already published questions are immutable.
- Pause/resume closes the submission window; reopen it explicitly when ready. Close submissions before moving on. Review pending short answers under Submissions. Correct answers earn the round's points once; wrong and unanswered questions earn zero.
- Manual score corrections in Scores require a reason and confirmation. Signed corrections are separate ledger entries, never negative marking for wrong answers. The original ledger and audit history cannot be updated, deleted, or truncated. Inspect the last 100 admin operations in the audit history and all score transactions in the ledger.
- End the event to show final champions or a tie. An ended event cannot be reopened; create another event from Settings. Organizers can switch event workspaces. Public lobby/leaderboard show the newest event; a participant's quiz restores their most recently joined event.
- Projector mode enlarges the leaderboard. Use the browser's fullscreen control if needed.

## Security model

Quiz tables have RLS enabled, no direct API grants, and no participant write policies. Every command is a fixed, parameterized `SECURITY DEFINER` database function with an empty search path. Administrator authorization re-reads `profiles.role`; database and server layout both protect organizer access. Participants authenticate with Supabase Auth; membership, team, captain permissions, active question, publication, and answer window are checked inside the transaction.

All mutations serialize on the event row, including registration, closing the window, publication, submission, and review. Team capacity and close-versus-submit races therefore use the same database lock. A unique `(question_id, team_id)` constraint permits one official team answer. Unique `quiz_scores.submission_id` prevents a second award. Pending answers can be reviewed once only. Round points and event content freeze when play starts.

Public state includes event name/status, published current question/options, round points, aggregate team standings, and question progress. Only the authenticated member sees their team's current submission and their own membership. Answer keys, join codes, full participant lists, all submissions, and audit details are available exclusively through the admin state RPC. No service-role client, fake scores, or browser-only registration/score storage is used.

## Preserve the challenge application

The previous home is `/challenges`, its individual coin leaderboard is `/challenge-leaderboard`, its admin summary is `/admin/challenges`, and its review queue is `/admin/review`. Tasks, accounts, profiles, evidence, coins, and their original database remain available. Quiz teams and points are independent of the original coin system.

## Verification

- `npm run check`: ESLint and Next.js route generation / TypeScript.
- `npm test`: 159 existing unit tests, 114 existing database permission checks, and 30 quiz workflow/security integration checks in actual PostgreSQL semantics via PGlite.
- `npm run test:quiz:concurrency`: starts a temporary embedded PostgreSQL 18 cluster and tests simultaneous capacity allocation, team submissions, repeated reviews, and closing a window while an answer waits for the event lock. Requires permission to start local PostgreSQL processes.
- `npm run build`: production build for all routes.
- `SCREENSHOT_PAGES=/,/join,/quiz,/leaderboard,/admin/login npm run screenshots` (PowerShell: set `$env:SCREENSHOT_PAGES` first): desktop, tablet, and mobile layout checks against a running server.

PGlite tests use a minimal Supabase Auth stub; they do not prove hosted Auth cookie refresh or Realtime websocket delivery. Before the event, use a configured staging Supabase project and two independent browsers to join, publish, submit, score, pause/resume, refresh, and confirm the live leaderboard updates. No Supabase project credentials were supplied in this workspace, so hosted verification and deployment require that configuration.
