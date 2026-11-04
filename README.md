# todo-api

Backend for the Tasks to-do app. Next.js 16 route handlers only (no pages), Postgres on **Supabase** via Prisma, email via **Resend**.
The frontend (`../to-do-app`) proxies every `/api/v1/*` call here, so there is no CORS setup. The spec is `../to-do-app/docs/API_CONTRACT.md`.

## Run it

```bash
npm install
npx prisma generate          # npm may block Prisma's postinstall script; this runs it by hand
cp .env.example .env         # then fill in the values (see below)
npm run db:migrate           # creates the tables in Supabase
npm run dev                  # http://localhost:4000/api/v1/health
```

Then in `../to-do-app`, run `npm run dev` (live mode) and open http://localhost:3000.

## Environment

| Name | Where to get it |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Supabase dashboard → **Connect** → **Session pooler** string (port 5432). Put your DB password in place of `[YOUR-PASSWORD]`, URL-encoded. |
| `JWT_ACCESS_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `RESEND_API_KEY` | resend.com → API Keys |
| `EMAIL_FROM` | `Tasks <onboarding@resend.dev>` while testing (only delivers to your Resend account's email). Verify a domain in Resend to email anyone. |
| `APP_URL` | Frontend URL, used in email links. `http://localhost:3000` locally. |
| `REMINDER_JOB_SECRET` | 32+ random characters | Bearer secret used by the scheduled reminder job. Keep it private. |
| `ENABLE_TEST_ROUTES` | `true` only locally/CI so the contract check can read email tokens. **Never in production.** |
| `RATE_LIMIT_DISABLED` | `true` only while running the contract check repeatedly. |

The app validates these at startup and refuses to boot if one is missing or malformed.

## Check against the contract

With `ENABLE_TEST_ROUTES=true` and `RATE_LIMIT_DISABLED=true` in `.env`, start the server and run from `../to-do-app`:

```bash
npm run contract     # 57 checks
```

Run `npm run db:migrate` after pulling schema changes. To enable reminders, set `REMINDER_JOB_SECRET` in `.env`, then configure a scheduler to `POST /api/v1/jobs/reminders` about once per minute with `Authorization: Bearer <secret>`. The job processes at most 25 emails per call. In local development, call it manually with the same header to test delivery.

## Layout

```
prisma/schema.prisma           data model; migrations/ holds the SQL (includes Supabase RLS lockdown)
src/app/api/v1/**/route.ts     thin routes: parse → one service call → respond
src/services/                  business rules (auth, user, todo), no Request/Response objects
src/schemas/                   Zod schemas for every body and query
src/serializers.ts             the only way data leaves the API (drops passwordHash, formats dates)
src/lib/                       env, db, errors, handler wrapper, rate limit, auth helpers, email
```

## Security notes

- Passwords: argon2id (OWASP params). Login runs argon2 even for unknown emails so timing doesn't reveal accounts.
- Access token: HS256 JWT, 15 min, algorithm pinned. Refresh token: random 32 bytes in an HttpOnly cookie scoped to `/api/v1/auth`, stored only as a SHA-256 hash, rotated on every use; reusing an old one revokes the whole session family. Rotation runs in a transaction with `SELECT … FOR UPDATE`.
- Every todo query filters by `userId`; another user's todo is a 404.
- **Supabase:** all tables have Row Level Security enabled with no policies, so the Supabase Data API (anon key) can't read them. This API connects as the table owner and is unaffected. Don't add RLS policies or use `supabase-js` against these tables.
