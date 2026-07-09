# Scrumlens Deployment Guide

This guide reflects the current production setup:

- Team-login only authentication
- Bun runtime
- Native MongoDB
- Admin-managed team logins via `/admin-users`

## Auth and Access Model

- Main login uses `POST /fixed-auth/login`.
- Login key is `teamId` (shown in admin UI as Team login).
- Personal auth endpoints under `/auth/signin`, `/auth/signup`, `/auth/signup-guest` are disabled.
- Admin account (`teamId=admin`) can view and manage all boards.
- Non-admin accounts only see their own team-owned boards.

## Recommended Deployment Flow (Proxmox LXC)

## 1. Copy source code to container

```bash
scp -r /path/to/scrumlens/* root@<container-ip>:/opt/scrumlens/
```

## 2. Run base setup (optional but recommended)

```bash
ssh root@<container-ip>
chmod +x /opt/scrumlens/scripts/setup-proxmox.sh
/opt/scrumlens/scripts/setup-proxmox.sh
```

## 3. Run deployment

```bash
chmod +x /opt/scrumlens/scripts/deploy-existing-container.sh
/opt/scrumlens/scripts/deploy-existing-container.sh
```

The deploy script:

- verifies/install Bun and Node tooling
- installs MongoDB (or supports external Mongo URL)
- installs dependencies
- builds client
- creates `.env` if missing
- creates systemd service for Scrumlens

## Environment

Edit `/opt/scrumlens/.env` after first deployment.

Minimum:

```env
API_PORT=3000
SECRET_KEY=<random-long-secret>
MONGO_URL=mongodb://localhost:27017/scrumlens
CLIENT_URL=https://your-domain.example
NODE_ENV=production
```

Notes:

- `CLIENT_URL` should be the URL users open in browser.
- `COOKIE_DOMAIN` can be set if needed; invalid domain breaks auth cookies.

## Bootstrap First Admin Team Login

You need at least one admin login.

Options:

1. Legacy helper script (creates admin + default team users):

```bash
cd /opt/scrumlens/apps/server
bun run scripts/setupUsers.ts
```

1. Preferred: create admin team-login in DB/admin route and manage all team logins in `/admin-users`.

## Start / Verify Service

```bash
systemctl daemon-reload
systemctl enable scrumlens
systemctl start scrumlens
systemctl status scrumlens
journalctl -u scrumlens -f
```

## Reverse Proxy

Proxy traffic to `http://<container-ip>:3000` with WebSocket upgrade headers enabled.

Nginx essentials:

- `proxy_set_header Upgrade $http_upgrade;`
- `proxy_set_header Connection 'upgrade';`
- `proxy_set_header X-Forwarded-Proto $scheme;`

## Operational Notes

- Dashboard search supports board title and team login (admin use case).
- Board display name is `ownerName: boardTitle`.
- Deleting a team login account deletes that team's boards and related notes/comments/polls.
- Vote/reaction identity is based on `voterName` (per person), not shared team userId.

## Security Checklist

- Always deploy behind HTTPS.
- Keep credentials secure.
- Rotate team passwords regularly.
- Restrict access to `/swagger` in production.
- Backup MongoDB regularly.

## Backup

```bash
mongodump --db scrumlens --out /backup/scrumlens/$(date +%Y%m%d)
```

Restore:

```bash
mongorestore --db scrumlens /backup/scrumlens/<date>/scrumlens/
```
