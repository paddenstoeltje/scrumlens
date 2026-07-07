#!/bin/bash
# =====================================================
# Scrumlens - Proxmox LXC Container Setup Script
# This script prepares a Debian/Ubuntu container for Scrumlens
# Run this script as root inside the LXC container
# =====================================================

set -e

echo "========================================="
echo "  Scrumlens Production Setup"
echo "========================================="

# -----------------------------------------
# 1. System Updates
# -----------------------------------------
echo "[1/8] Updating system packages..."
apt-get update && apt-get upgrade -y

# -----------------------------------------
# 2. Install Dependencies
# -----------------------------------------
echo "[2/8] Installing dependencies..."
apt-get install -y \
    curl \
    git \
    ca-certificates \
    openssl \
    nginx \
    mongodb-org \
    or \
    apt-get install -y \
    curl \
    git \
    ca-certificates \
    openssl \
    nginx

# Install Node.js (LTS)
echo "Installing Node.js LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# -----------------------------------------
# 3. Create Application User
# -----------------------------------------
echo "[3/8] Creating application user..."
if ! id -u scrumlens &>/dev/null; then
    adduser --system --no-create-home --group scrumlens
fi

# -----------------------------------------
# 4. Clone and Build Scrumlens
# -----------------------------------------
echo "[4/8] Setting up application..."
APP_DIR="/opt/scrumlens"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# If the source is not already present, clone from git
if [ ! -d ".git" ] && [ ! -f "package.json" ]; then
    echo "Cloning Scrumlens repository..."
    # Replace with your actual repo URL
    # git clone https://github.com/your-org/scrumlens.git .
    echo "# Manual: Copy the scrumlens source to $APP_DIR"
fi

# Install dependencies
echo "Installing npm dependencies..."
npm install --production

# Build the application
echo "Building the application..."
npm run build:client

# -----------------------------------------
# 5. Environment Configuration
# -----------------------------------------
echo "[5/8] Configuring environment..."
ENV_FILE="$APP_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    cp .env.example "$ENV_FILE"
    
    # Generate secret key
    SECRET_KEY=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    sed -i "s/SECRET_KEY=your-secret-key-here/SECRET_KEY=$SECRET_KEY/" "$ENV_FILE"
    
    echo "Environment file created at $ENV_FILE"
    echo "IMPORTANT: Edit $ENV_FILE to configure MongoDB, ports, and email settings."
else
    echo "Environment file already exists. Skipping."
fi

# -----------------------------------------
# 6. Generate Team Passwords
# -----------------------------------------
echo "[6/8] Generating team passwords..."
PASSWORDS_FILE="$APP_DIR/passwords.md"

if [ ! -f "$PASSWORDS_FILE" ]; then
    node generatePasswords.mjs > "$PASSWORDS_FILE"
    echo "Passwords generated at $PASSWORDS_FILE"
    chmod 600 "$PASSWORDS_FILE"
else
    echo "Passwords file already exists. Skipping."
fi

# -----------------------------------------
# 7. Create Systemd Service
# -----------------------------------------
echo "[7/8] Setting up systemd service..."
cat > /etc/systemd/system/scrumlens.service <<EOF
[Unit]
Description=Scrumlens Retrospective Tool Server
After=network.target mongodb.service
Wants=mongodb.service

[Service]
Type=simple
User=scrumlens
Group=scrumlens
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Create nginx reverse proxy config
cat > /etc/nginx/sites-available/scrumlens <<'NGINXEOF'
upstream scrumlens_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP -> HTTPS redirect (uncomment in production)
# server {
#     listen 80;
#     server_name your-domain.com;
#     return 301 https://$server_name$request_uri;
# }

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (use Let's Encrypt)
    # ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Client settings
    client_max_body_size 10m;

    location / {
        proxy_pass http://scrumlens_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Swagger docs (optional - restrict in production)
    location /swagger {
        proxy_pass http://scrumlens_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 256;
}
NGINXEOF

ln -sf /etc/nginx/sites-available/scrumlens /etc/nginx/sites-enabled/scrumlens
rm -f /etc/nginx/sites-enabled/default

echo "Nginx config created at /etc/nginx/sites-available/scrumlens"
echo "IMPORTANT: Edit the nginx config to set your domain and SSL certificates."

# -----------------------------------------
# 8. Start Services
# -----------------------------------------
echo "[8/8] Starting services..."
systemctl daemon-reload
systemctl enable scrumlens.service
systemctl enable nginx.service

echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Edit $ENV_FILE to configure MongoDB connection and other settings"
echo "2. Edit /etc/nginx/sites-available/scrumlens for domain/SSL config"
echo "3. Start MongoDB: systemctl start mongodb.service (or mongod)"
echo "4. Start the app: systemctl start scrumlens"
echo "5. Check status: systemctl status scrumlens"
echo "6. View passwords: cat $PASSWORDS_FILE"
echo ""
echo "Access the application at:"
echo "  http://<container-ip>"
echo "  https://<your-domain> (after SSL setup)"
echo ""