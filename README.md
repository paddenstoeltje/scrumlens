# Scrumlens

Scrumlens is a real-time retrospective board app built with Nuxt (client) and Elysia/Bun (server) on MongoDB.

## Current Auth Model

- Team-login only.
- Personal signup/signin/guest auth endpoints are disabled.
- Users log in via `/fixed-auth/login` using:
  - `username` = team login key (`teamId`)
  - `password` = shared team password
- Team logins are managed in the admin panel at `/admin-users`.

Notes:

- `email` is a technical/internal field and auto-derived from team login.
- Admin can see/manage all boards.
- Non-admin users only see their own team-owned boards.

## Core Behavior

- Board cards are shown as `ownerName: boardTitle`.
- Dashboard search supports:
  - board title
  - team login / owner name (admin use case)
- Deleting a team login account also deletes that team's boards and related notes/comments/polls.
- Voting/reactions use per-browser `voterName` (trimmed string), independent from shared team login.

## Monorepo Layout

- `apps/client`: Nuxt frontend
- `apps/server`: Elysia backend
- `shared/types`: shared server/client event/cookie types
- `scripts`: deployment helpers

## Development

From repository root:

```bash
bun main.ts
```

Useful commands:

```bash
npm run build:client
bun run lint
bun run generate:api
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment (Proxmox/LXC and native MongoDB).

## Security

- Keep team credentials secure.
- Use HTTPS behind reverse proxy.
- Rotate team passwords periodically.
