# Quiz verification — 16 October 2026

Passed locally:

| Check | Result |
| --- | --- |
| ESLint + Next.js route generation + TypeScript | Passed |
| Production Next.js build | Passed; all 36 pages generated |
| Existing unit suite | 159 passed |
| Existing database permission suite | 114 passed |
| Quiz PostgreSQL integration suite | 30 passed |
| Quiz real PostgreSQL concurrency suite | 4 passed |
| Public-page browser layout checks | 15 passed: 5 pages × desktop/tablet/mobile |

The integration checks exercise admin authorization, private keys and join codes, membership persistence, team capacity, captain/any-member permissions, submission windows, unreleased questions, exact-once scoring, correct/wrong MCQ and short answers, pause/resume, frozen round points, reasoned corrections, immutable scoring/audit history, and final ties.

The concurrency suite uses PostgreSQL 18.4 on separate connections to check capacity allocation, competing team answers, competing evaluations, and submission-window closure against a waiting answer transaction.

Browser checks covered `/`, `/join`, `/quiz`, `/leaderboard`, and `/admin/login` at 1440px, 820px, and 390px. No browser console errors or horizontal overflow were found. Screenshots are in `.screenshots/` (ignored generated output).

No hosted Supabase environment or credentials were supplied. Hosted anonymous Auth, organizer login, token refresh, Realtime websocket delivery, and deployment are therefore pending staging configuration and two-browser verification described in [live-quiz.md](live-quiz.md). Public UI verification used honest empty/unconfigured states; no fabricated production scores were inserted.

Environment-specific notes: this Windows sandbox gives separate temporary directories to worker processes. The unit runner uses a stable writable `.test-tmp` directory. A clean production build outside the sandbox passed; stale Turbopack worker caches needed removal between sandbox contexts. The application uses local font stacks to avoid build-time font network requests.
