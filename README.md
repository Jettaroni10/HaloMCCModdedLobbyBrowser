# Halo MCC Custom Games Invite Coordinator

Opt-in lobby listings and invite request tracking for Halo MCC custom games.

Not affiliated with Microsoft, Xbox, 343 Industries, or Halo.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + Postgres
- Auth: handle/email with signed session cookie
- Realtime: Ably (chat) + Server-Sent Events (roster/host events)
- Maintenance: cron cleanup endpoint

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

3. Update `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAILS`, and `ABLY_API_KEY` in `.env`, then run migrations:

```bash
npx prisma migrate dev
```

4. Start the dev server:

```bash
npm run dev
```

## Routes

- `/` onboarding + disclaimers
- `/browse` browse listings
- `/lobbies/[id]` lobby detail + invite request
- `/host` host dashboard (host role required)
- `/host/new` create lobby
- `/settings/profile` profile settings
- `/admin` admin moderation (admin role required)
- `/legal` disclaimer + rules

## Notes

- Lobbies are opt-in and only include what hosts publish.
- Modded support is metadata + Steam Workshop links only.
- The app does not read MCC state, scan sessions, or send invites on your behalf.

## Maintenance

Run the cleanup job every 1–5 minutes via scheduler:

```
/api/cron/cleanup?secret=YOUR_CRON_SECRET
```
