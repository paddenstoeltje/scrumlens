# Scrumlens - Production Deployment Guide

This guide explains how to deploy Scrumlens for 24 teams with fixed team-based authentication on a Proxmox LXC container (no Docker).

## Features

- **Team-Based Authentication**: 24 teams (team1-team24) with shared credentials
- **Admin Access**: Single admin account can view all team boards and manage users
- **User Management Panel**: Admin-only web interface to create/edit/delete users
- **No User Registration**: Pre-configured users eliminate the need for login management
- **Real-time Collaboration**: Multiple team members can work on the same boards simultaneously
- **Role-Based Access Control**: Admin, Editor, and Viewer roles

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet / LAN                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Reverse Proxy (Nginx)                       │
│         HTTPS termination + Domain routing                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Proxmox LXC Container                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Node.js (Bun) Application - Port 3000               │    │
│  │  ├─ Fixed Auth (team1-team24, admin)                 │    │
│  │  ├─ REST API (boards, notes, polls, comments)        │    │
│  │  └─ Admin User Management Panel                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│  ┌───────────────────────────▼──────────────────────────┐   │
│  │  MongoDB (native) - Port 27017                        │   │
│  │  Stores: boards, notes, polls, comments, users       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Transfer Files to Existing Container

```bash
# From your development machine:
scp -r /path/to/scrumlens/* root@<container-ip>:/tmp/
```

### 2. Run Deployment Script (inside container)

```bash
# SSH into the container
ssh root@<container-ip>

# Make the script executable
chmod +x /tmp/deploy-existing-container.sh

# Run the setup
/tmp/deploy-existing-container.sh
```

The script will:
- Verify Node.js and Bun are installed
- Install MongoDB (if not already present)
- Create a `scrumlens` system user
- Install dependencies and build the client
- Generate environment file with auto-generated SECRET_KEY
- Set up systemd service for auto-restart

### 3. Seed Initial Users

After deployment, seed the database with admin and team users:

```bash
cd /opt/scrumlens
bun run scripts/setupUsers.ts
```

This creates:
- **admin** user (role: admin) - can view all boards and manage users
- **team1** through **team24** users (role: editor) - each tied to their team

The script outputs all passwords in the terminal. Store them securely!

### 4. Configure Environment (if needed)

```bash
nano /opt/scrumlens/.env
```

**Only 2 values typically need changing:**

| Variable    | Default                              | When to Change                      |
|-------------|--------------------------------------|-------------------------------------|
| `MONGO_URL` | `mongodb://localhost:27017/scrumlens` | Use external MongoDB server         |
| `CLIENT_URL`| `http://localhost:3001`              | Set your domain or container IP     |

**All other values are optional:**
- Email settings (empty = disabled, which is fine for basic use)
- `NODE_ENV=production` (already set)
- `API_PORT=3000` (internal port, behind reverse proxy)

### 5. Start the Application

```bash
# Reload systemd
systemctl daemon-reload

# Enable auto-start on boot
systemctl enable scrumlens

# Start the service
systemctl start scrumlens

# Check status
systemctl status scrumlens
```

### 6. Configure Reverse Proxy

Your reverse proxy should be configured to forward requests to `http://<container-ip>:3000`.

**Example Nginx reverse proxy config (on your proxy server):**
```nginx
server {
    listen 443 ssl http2;
    server_name scrumlens.your-domain.com;

    # SSL certificates (Let's Encrypt recommended)
    ssl_certificate /etc/letsencrypt/live/scrumlens.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scrumlens.your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 10M;

    location / {
        proxy_pass http://<container-ip>:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # WebSocket support
        proxy_read_timeout 86400;
    }

    # API docs (development only - disable in production)
    # location /swagger {
    #     proxy_pass http://<container-ip>:3000/swagger;
    # }
}
```

## Team Credentials

### Password Generation

To generate new random passwords:

```bash
cd /opt/scrumlens
bun run scripts/generateTeamPasswords.ts
```

This creates/updates `passwords.md` in the project root with all credentials.

### Passwords File Location
```
/opt/scrumlens/passwords.md
```

### User Scheme
| Username | Description | Access Level |
|----------|-------------|--------------|
| admin | Administrator | All team boards + user management |
| team1 | Team 1 members | Team 1 boards only |
| team2 | Team 2 members | Team 2 boards only |
| ... | ... | ... |
| team24 | Team 24 members | Team 24 boards only |

### Important Notes
- All members of a team share the same credentials
- The admin can view ALL boards from all teams and manage users via `/admin-users`
- Regular team users can ONLY see their own team's boards
- Keep `passwords.md` secure (`chmod 600 passwords.md`)

## Admin User Management Panel

The admin user has access to a dedicated user management panel at `/admin-users`.

### Features
- **View all users** with pagination and filtering (by role, team, search)
- **Create new users** with custom credentials
- **Edit existing users** (name, email, team, role, active status)
- **Reset passwords** for any user
- **Delete users** (except yourself)

### Accessing the Panel
1. Log in as `admin`
2. Navigate to `/admin-users`
3. If you're not an admin, you'll be redirected to login

## Environment File Explained

The `.env` file at `/opt/scrumlens/.env` contains:

```env
# Required: Internal server port (behind reverse proxy)
API_PORT=3000

# Auto-generated: JWT secret key (don't modify manually)
SECRET_KEY=<auto-generated>

# Required: MongoDB connection
MONGO_URL=mongodb://localhost:27017/scrumlens

# Required: Client URL for redirects
CLIENT_URL=https://scrumlens.your-domain.com

# Optional: Node environment
NODE_ENV=production

# Optional: Email settings (leave empty if not needed)
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_FROM=
```

**Minimal .env file (if you only need basic functionality):**
```env
API_PORT=3000
MONGO_URL=mongodb://localhost:27017/scrumlens
CLIENT_URL=https://scrumlens.your-domain.com
NODE_ENV=production
```

## Maintenance

### View Logs
```bash
# Application logs
journalctl -u scrumlens -f

# Recent logs (last 50 lines)
journalctl -u scrumlens -n 50
```

### Restart Service
```bash
systemctl restart scrumlens
```

### Update Application
```bash
cd /opt/scrumlens
git pull
bun install
bun run build:client
systemctl restart scrumlens
```

### Regenerate Passwords
```bash
cd /opt/scrumlens
bun run scripts/generateTeamPasswords.ts
```

### Re-seed Users (if database is empty)
```bash
cd /opt/scrumlens
bun run scripts/setupUsers.ts
```

## Troubleshooting

### Service Won't Start
```bash
# Check status
systemctl status scrumlens

# View logs
journalctl -u scrumlens -n 100

# Test environment file
cd /opt/scrumlens && node -e "console.log(process.env)"
```

### MongoDB Connection Issues
```bash
# If using local MongoDB, start it:
systemctl start mongod

# If using external MongoDB, verify connection:
mongosh <your-mongo-url> --eval "db.adminCommand('ping')"
```

### Can't Access Application
1. Check if service is running: `systemctl status scrumlens`
2. Check if port is listening: `netstat -tlnp | grep 3000`
3. Verify reverse proxy config points to correct container IP
4. Test directly: `http://<container-ip>:3000`

### Admin Panel Not Accessible
1. Verify user has `role: admin` in the database
2. Check browser console for errors
3. Ensure JWT token is valid (try logging out and back in)

## API Endpoints

### Fixed Authentication (Team Login)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/fixed-auth/login` | Login with team credentials |
| POST | `/fixed-auth/logout` | Logout |

### User Management (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | Get all users |
| GET | `/admin/users/:id` | Get user by ID |
| POST | `/admin/users` | Create new user |
| PUT | `/admin/users/:id` | Update user |
| DELETE | `/admin/users/:id` | Delete user |
| POST | `/admin/users/:id/reset-password` | Reset user password |

### Boards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/boards/all` | Get all boards from all teams (admin) |
| GET | `/boards/` | Get team-specific boards |
| GET | `/boards/:id` | Get single board details |
| POST | `/boards/` | Create new board |

### Swagger API Docs
```
http://<container-ip>:3000/swagger
```

## Security Considerations

- **Use HTTPS**: Always deploy behind a reverse proxy with SSL/TLS
- **Keep passwords.md secure**: `chmod 600 passwords.md`
- **Delete after distribution**: Archive and remove passwords.md after distributing credentials
- **Change passwords**: Consider changing default passwords after initial setup
- **Disable Swagger in production**: Remove or restrict access to `/swagger` endpoint
- **Regular updates**: Keep Node.js, Bun, and dependencies up to date
- **Firewall**: Only expose necessary ports (443/80 for reverse proxy)
- **Backup**: Regularly backup the MongoDB database

## Database Backup

```bash
# MongoDB dump
mongodump --db scrumlens --out /backup/scrumlens/$(date +%Y%m%d)

# Restore
mongorestore --db scrumlens /backup/scrumlens/<date>/scrumlens/
```

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2 cores |
| RAM | 512 MB | 1 GB |
| Disk | 10 GB | 20 GB |
| OS | Debian 12 (Bookworm) | Debian 12 (Bookworm) |

## Installed Dependencies

- **Node.js** (v20+)
- **Bun** (runtime)
- **MongoDB** (database - latest available auto-detected: tries 8.0 → 7.0 → 6.0)
- **Nginx** (reverse proxy, optional)

---

# Debian 12 Deployment Guide

This section provides detailed instructions for deploying Scrumlens on a fresh Proxmox LXC container running Debian 12 (Bookworm).

## Prerequisites

- Proxmox VE installed and accessible
- Root access to the Proxmox host
- Network connectivity from the container to the internet (for MongoDB installation)

## Step 1: Create the LXC Container

```bash
# On your Proxmox host, create a new LXC container:
pct create 100 \
    -arch amd64 \
    -cores 2 \
    -memory 1024 \
    -swap 512 \
    -net0 name=eth0,bridge=vmbr0,ip=172.22.2.14/24,gw=172.22.2.1 \
    -hostname scrumlens \
    -rootfs local-lvm:10 \
    -unprivileged 1 \
    -password '<root-password>'
```

Start the container:
```bash
pct start 100
pct set 100 -boot c -bootdisk scsi0
```

## Step 2: Initial Container Setup

SSH into the container and run initial setup:

```bash
ssh root@172.22.2.14

# Update system packages
apt-get update && apt-get upgrade -y

# Install basic utilities
apt-get install -y curl gnupg ca-certificates git
```

## Step 3: Install MongoDB

Debian 12 doesn't include MongoDB in its default repositories, so we add the official MongoDB repository. The deployment script automatically tries to install the **latest available MongoDB version** (tries 8.0 first, falls back to 7.0 or 6.0 if not available for your OS).

> **MongoDB version by OS:**
> - Debian 12 (Bookworm) → MongoDB 7.0 (8.0 not yet available)
> - Debian 11 (Bullseye) → MongoDB 6.0
> - Ubuntu 24.04+ → MongoDB 8.0

```bash
# The deployment script handles this automatically.
# For reference, here's what it does:

# Import MongoDB GPG key (tries 8.0 first, falls back to 7.0)
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# Add MongoDB repository for Debian 12 (Bookworm)
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update package lists and install MongoDB
apt-get update -y
apt-get install -y mongodb-org

# Start and enable MongoDB
systemctl start mongod
systemctl enable mongod

# Verify installed version
mongod --version
```

### Configure MongoDB (optional)

By default, MongoDB runs without authentication. For production use, consider creating an admin user:

```bash
mongosh
> use scrumlens
> db.createUser({
>   user: "scrumlens",
>   pwd: "<strong-password>",
>   roles: [{ role: "readWrite", db: "scrumlens" }]
> })
> exit
```

Then edit `/etc/mongod.conf` to enable authentication:
```yaml
security:
  authorization: enabled
```

Restart MongoDB after enabling authentication and update your `MONGO_URL` in `.env`:
```
MONGO_URL=mongodb://scrumlens:<strong-password>@localhost:27017/scrumlens
```

## Step 4: Install Bun Runtime

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH for current session
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Make persistent
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
```

Verify installation:
```bash
bun -v
```

## Step 5: Deploy Scrumlens Application

### Option A: Using the Deployment Script (Recommended)

Transfer and run the deployment script:

```bash
# From your development machine:
scp -r /path/to/scrumlens/* root@172.22.2.14:/tmp/

# On the container:
cd /tmp
chmod +x deploy-existing-container.sh
./deploy-existing-container.sh
```

The script will automatically:
- Detect Debian 12 and install MongoDB if needed
- Install Bun runtime
- Set up the application directory at `/opt/scrumlens`
- Install dependencies and build the client
- Create a systemd service for auto-restart

### Option B: Manual Deployment

```bash
# Create application user
adduser --system --no-create-home --group scrumlens

# Setup application directory
mkdir -p /opt/scrumlens
cd /opt/scrumlens

# Copy source code (from scp or git clone)
# If using git:
git clone <your-repo-url> .

# Install dependencies and build
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

cd apps/server && bun install --frozen && cd ../..
cd apps/client && bun install --frozen --ignore-scripts && npx nuxt prepare && bun run build && cd ../..

# Create environment file
cat > /opt/scrumlens/.env <<EOF
API_PORT=3000
SECRET_KEY=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
MONGO_URL=mongodb://localhost:27017/scrumlens
NODE_ENV=production
CLIENT_URL=http://172.22.2.14:3000
EOF

# Create systemd service
cat > /etc/systemd/system/scrumlens.service <<EOF
[Unit]
Description=Scrumlens Retrospective Tool Server
After=network.target mongod.service

[Service]
Type=simple
User=scrumlens
Group=scrumlens
WorkingDirectory=/opt/scrumlens/apps/server
Environment=NODE_ENV=production
EnvironmentFile=/opt/scrumlens/.env
ExecStart=/root/.bun/bin/bun run src/index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl daemon-reload
systemctl enable scrumlens
systemctl start scrumlens
```

## Step 6: Seed the Database

```bash
cd /opt/scrumlens/apps/server
bun run scripts/setupUsers.ts
```

This creates:
- Admin user with full access
- team1 through team24 users

## Step 7: Configure Reverse Proxy (Optional but Recommended)

Install Nginx and configure HTTPS:

```bash
# Install Nginx and Certbot
apt-get install -y nginx certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d scrumlens.your-domain.com

# Configure reverse proxy (Certbot usually does this automatically)
```

## Step 8: Firewall Configuration

```bash
# Install UFW
apt-get install -y ufw

# Allow SSH, HTTP, and HTTPS
ufw allow OpenSSH
ufw allow 'Nginx Full'

# Enable firewall
ufw --force enable
```

## Monitoring and Maintenance

### Check Application Status
```bash
systemctl status scrumlens
journalctl -u scrumlens -f
```

### Check MongoDB Status
```bash
systemctl status mongod
journalctl -u mongod -f
```

### Backup MongoDB
```bash
# Create backup directory
mkdir -p /backup/scrumlens

# Daily backup script (add to crontab)
cat > /usr/local/bin/backup-scrumlens.sh <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
mongodump --db scrumlens --out /backup/scrumlens/$DATE
find /backup/scrumlens -maxdepth 1 -mtime +30 -exec rm -rf {} \;
EOF

chmod +x /usr/local/bin/backup-scrumlens.sh

# Add to crontab for daily backups at 2 AM
echo "0 2 * * * /usr/local/bin/backup-scrumlens.sh" | crontab -
```

### Update Application
```bash
cd /opt/scrumlens
git pull
bun install
bun run build:client
systemctl restart scrumlens
```

## Troubleshooting

### MongoDB Not Starting
```bash
# Check MongoDB logs
journalctl -u mongod -n 100

# Verify configuration
cat /etc/mongod.conf

# Fix permissions if needed
chown -R mongodb:mongodb /var/lib/mongodb
chown -R mongodb:mongodb /var/log/mongodb
```

### Application Won't Start
```bash
# Check logs
journalctl -u scrumlens -n 100

# Verify environment file
cat /opt/scrumlens/.env

# Test MongoDB connection
mongosh --eval "db.adminCommand('ping')"
```

### Port Already in Use
```bash
# Check what's using port 3000
netstat -tlnp | grep 3000

# Check what's using port 27017
netstat -tlnp | grep 27017