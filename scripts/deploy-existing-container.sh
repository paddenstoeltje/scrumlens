#!/bin/bash
# =====================================================
# Scrumlens - Deployment Script for Existing Container
# Uses native MongoDB (no FerretDB or PostgreSQL needed)
# Run this script as root inside the existing LXC container
# =====================================================

set -e

echo "========================================="
echo "  Scrumlens Deployment (Existing Container)"
echo "  Using Native MongoDB"
echo "========================================="

# -----------------------------------------
# Helper function to install packages
# -----------------------------------------
install_packages() {
    local pkg_manager=$1
    shift
    echo ""
    echo "Installing packages using $pkg_manager..."
    
    if [ "$pkg_manager" = "apt-get" ]; then
        apt-get update -y
        apt-get install -y "$@"
    elif [ "$pkg_manager" = "yum" ] || [ "$pkg_manager" = "dnf" ]; then
        yum install -y "$@"
    elif [ "$pkg_manager" = "apk" ]; then
        apk add "$@"
    else
        echo "ERROR: Unknown package manager: $pkg_manager"
        return 1
    fi
    
    echo "Packages installed successfully."
}

# -----------------------------------------
# Helper function to install Bun
# -----------------------------------------
install_bun() {
    echo ""
    echo "Installing Bun runtime..."
    
    # Install Bun
    curl -fsSL https://bun.sh/install | bash
    
    # Add to PATH for all users
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # Add to bashrc for persistence
    echo 'export BUN_INSTALL="$HOME/.bun"' >> /root/.bashrc
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /root/.bashrc
    
    # Also add to /etc/profile.d for all users
    cat > /etc/profile.d/bun.sh <<'BUNEOF'
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
BUNEOF
    
    chmod +x /etc/profile.d/bun.sh
    
    echo "Bun installed successfully: $(bun -v)"
}

# -----------------------------------------
# Helper function to find Bun path
# -----------------------------------------
find_bun_path() {
    if command -v bun &> /dev/null; then
        which bun
    elif [ -f "$HOME/.bun/bin/bun" ]; then
        echo "$HOME/.bun/bin/bun"
    else
        for path in /root/.bun/bin/bun ~/.bun/bin/bun /usr/local/bin/bun /home/*/.bun/bin/bun; do
            if [ -f "$path" ]; then
                echo "$path"
                return 0
            fi
        done
    fi
    echo ""
}

# -----------------------------------------
# Helper function to install Node.js (fallback)
# -----------------------------------------
install_nodejs() {
    echo ""
    echo "Installing Node.js LTS (v20)..."
    
    # Detect package manager
    local pkg_manager=""
    if command -v apt-get &> /dev/null; then
        pkg_manager="apt-get"
    elif command -v yum &> /dev/null; then
        pkg_manager="yum"
    elif command -v dnf &> /dev/null; then
        pkg_manager="dnf"
    elif command -v apk &> /dev/null; then
        pkg_manager="apk"
    fi
    
    if [ "$pkg_manager" = "apt-get" ]; then
        apt-get update -y
        apt-get install -y curl gnupg
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif [ "$pkg_manager" = "yum" ] || [ "$pkg_manager" = "dnf" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    elif [ "$pkg_manager" = "apk" ]; then
        apk add --no-cache nodejs npm
    else
        echo "ERROR: Could not detect package manager. Please install Node.js manually."
        return 1
    fi
    
    echo "Node.js installed successfully: $(node -v)"
}

# -----------------------------------------
# Helper function to install Git
# -----------------------------------------
install_git() {
    echo ""
    echo "Installing git..."
    
    local pkg_manager=""
    if command -v apt-get &> /dev/null; then
        pkg_manager="apt-get"
    elif command -v yum &> /dev/null || command -v dnf &> /dev/null; then
        pkg_manager=$(command -v dnf 2>/dev/null || command -v yum)
    elif command -v apk &> /dev/null; then
        pkg_manager="apk"
    fi
    
    if [ "$pkg_manager" = "apt-get" ]; then
        apt-get install -y git
    elif [ "$pkg_manager" = "yum" ] || [ "$pkg_manager" = "dnf" ]; then
        yum install -y git
    elif [ "$pkg_manager" = "apk" ]; then
        apk add --no-cache git
    fi
    
    echo "Git installed successfully: $(git --version)"
}

# -----------------------------------------
# Helper function to install latest MongoDB available for the OS
# -----------------------------------------
install_mongodb() {
    echo ""
    echo "Installing latest available MongoDB..."
    
    local ARCH=$(uname -m)
    
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu - import MongoDB GPG key and repository
        apt-get install -y gnupg curl ca-certificates
        
        # Determine Debian/Ubuntu version
        local DEBIAN_VERSION=""
        if grep -q "bookworm" /etc/os-release; then
            DEBIAN_VERSION="debian12"
        elif grep -q "bullseye" /etc/os-release; then
            DEBIAN_VERSION="debian11"
        else
            DEBIAN_VERSION=$(grep -oP 'VERSION_CODENAME=\K.*' /etc/os-release || echo "debian12")
        fi
        
        echo "  Detected OS: $DEBIAN_VERSION"
        
        # Try latest MongoDB first (8.0), fall back to 7.0, then 6.0
        local MONGO_VERSIONS="8.0 7.0 6.0"
        local INSTALLED_VERSION=""
        
        for VERSION in $MONGO_VERSIONS; do
            echo "  Trying MongoDB $VERSION..."
            
            # Import MongoDB GPG key for this version
            if curl -fsSL "https://www.mongodb.org/static/pgp/server-${VERSION}.asc" 2>/dev/null | gpg --dearmor -o "/usr/share/keyrings/mongodb-server-${VERSION}.gpg" 2>/dev/null; then
                # Add MongoDB repository for this version
                echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-${VERSION}.gpg ] http://repo.mongodb.org/apt/debian ${DEBIAN_VERSION}/mongodb-org/${VERSION} main" > /etc/apt/sources.list.d/mongodb-org-${VERSION}.list
                
                # Update and check if packages exist
                if apt-get update -qq 2>/dev/null && apt-cache show mongodb-org 2>/dev/null | grep -q "Version:"; then
                    echo "  MongoDB $VERSION is available!"
                    INSTALLED_VERSION="$VERSION"
                    break
                fi
                
                # Clean up if this version doesn't work
                rm -f "/etc/apt/sources.list.d/mongodb-org-${VERSION}.list"
                rm -f "/usr/share/keyrings/mongodb-server-${VERSION}.gpg"
            fi
        done
        
        if [ -z "$INSTALLED_VERSION" ]; then
            echo "  ERROR: No supported MongoDB version found for this OS."
            echo "  Please install MongoDB manually or use a newer OS."
            return 1
        fi
        
        MONGO_VERSION="$INSTALLED_VERSION"
        
        # Update and install MongoDB
        apt-get update -y
        apt-get install -y "mongodb-org"
        
        echo "  Installed MongoDB $MONGO_VERSION (latest available for $DEBIAN_VERSION)"
    elif command -v dnf &> /dev/null; then
        # Fedora/RHEL - try latest MongoDB first, fall back to 7.0
        local RHEL_VERSION=$(rpm -E '%{rhel}')
        local MONGO_VERSION="8.0"
        
        cat > /etc/yum.repos.d/mongodb-org-${MONGO_VERSION}.repo <<EOF
[mongodb-org-${MONGO_VERSION}]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/${RHEL_VERSION}/mongodb-org/${MONGO_VERSION}/\$basearch/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-${MONGO_VERSION}.asc
EOF
        
        if ! dnf install -y mongodb-org 2>/dev/null; then
            # Fall back to MongoDB 7.0
            echo "  MongoDB 8.0 not available, falling back to 7.0..."
            MONGO_VERSION="7.0"
            cat > /etc/yum.repos.d/mongodb-org-${MONGO_VERSION}.repo <<EOF
[mongodb-org-${MONGO_VERSION}]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/${RHEL_VERSION}/mongodb-org/${MONGO_VERSION}/\$basearch/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-${MONGO_VERSION}.asc
EOF
            dnf install -y mongodb-org
        fi
        
    elif command -v yum &> /dev/null; then
        # RHEL/CentOS - try latest MongoDB first, fall back to 7.0
        local RHEL_VERSION=$(rpm -E '%{rhel}')
        local MONGO_VERSION="8.0"
        
        cat > /etc/yum.repos.d/mongodb-org-${MONGO_VERSION}.repo <<EOF
[mongodb-org-${MONGO_VERSION}]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/${RHEL_VERSION}/mongodb-org/${MONGO_VERSION}/\$basearch/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-${MONGO_VERSION}.asc
EOF
        
        if ! yum install -y mongodb-org 2>/dev/null; then
            # Fall back to MongoDB 7.0
            echo "  MongoDB 8.0 not available, falling back to 7.0..."
            MONGO_VERSION="7.0"
            cat > /etc/yum.repos.d/mongodb-org-${MONGO_VERSION}.repo <<EOF
[mongodb-org-${MONGO_VERSION}]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/${RHEL_VERSION}/mongodb-org/${MONGO_VERSION}/\$basearch/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-${MONGO_VERSION}.asc
EOF
            yum install -y mongodb-org
        fi
    else
        echo "ERROR: Could not detect package manager."
        return 1
    fi
    
    # Start MongoDB
    systemctl start mongod
    systemctl enable mongod
    
    echo "MongoDB installed and enabled."
}


# -----------------------------------------
# 0. Pre-flight Checks
# -----------------------------------------
echo ""
echo "[Pre-check] Verifying required tools..."

MISSING_DEPS=()

# Check for Bun (preferred runtime)
HAS_BUN=false
if command -v bun &> /dev/null; then
    HAS_BUN=true
    BUN_VERSION=$(bun -v)
    echo "  [OK] Bun: $BUN_VERSION"
else
    echo "  [!] Bun: NOT INSTALLED (will be installed)"
fi

# Check for Node.js (fallback, needed for client build)
HAS_NODE=false
if command -v node &> /dev/null; then
    HAS_NODE=true
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        echo "  [OK] Node.js: $(node -v) (available)"
    else
        echo "  [!] Node.js: $(node -v) (too old, need v20+)"
    fi
else
    echo "  [ ] Node.js: NOT INSTALLED"
fi

# Check for npm (optional now, bun handles everything)
if command -v npm &> /dev/null; then
    echo "  [OK] npm: $(npm -v)"
else
    echo "  [ ] npm: NOT INSTALLED (not required - using bun)"
fi

# Check for Git (optional, for cloning)
HAS_GIT=false
if command -v git &> /dev/null; then
    HAS_GIT=true
    echo "  [OK] git: $(git --version)"
else
    echo "  [ ] git: NOT INSTALLED (optional, needed for cloning from git)"
fi

# Check for MongoDB (can use external)
HAS_MONGO=false
if command -v mongod &> /dev/null; then
    HAS_MONGO=true
    echo "  [OK] MongoDB: INSTALLED"
else
    echo "  [ ] MongoDB: NOT INSTALLED (will install or use external)"
fi

# Check for tar/curl (needed for installation)
if ! command -v tar &> /dev/null; then
    MISSING_DEPS+=("tar")
    echo "  [!] tar: NOT INSTALLED (required)"
else
    echo "  [OK] tar: available"
fi

if ! command -v curl &> /dev/null; then
    MISSING_DEPS+=("curl")
    echo "  [!] curl: NOT INSTALLED (required)"
else
    echo "  [OK] curl: available"
fi

echo ""

# -----------------------------------------
# Install missing dependencies?
# -----------------------------------------
if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo "The following required packages are missing:"
    for dep in "${MISSING_DEPS[@]}"; do
        echo "  - $dep"
    done
    echo ""
    read -p "Would you like to install them now? [Y/n]: " INSTALL_NOW
    
    if [[ "$INSTALL_NOW" =~ ^[Nn]$ ]]; then
        echo ""
        echo "ERROR: Required dependencies not installed. Please install them manually and re-run this script."
        exit 1
    fi
    
    # Install missing packages based on OS detection
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt-get"
    elif command -v yum &> /dev/null || command -v dnf &> /dev/null; then
        PKG_MANAGER=$(command -v dnf 2>/dev/null || command -v yum)
    else
        PKG_MANAGER="apk"
    fi
    
    for dep in "${MISSING_DEPS[@]}"; do
        case "$dep" in
            npm)
                $PKG_MANAGER install -y npm || echo "Could not install npm separately."
                ;;
            tar|curl)
                install_packages "$PKG_MANAGER" "$dep"
                ;;
        esac
    done
    
    # Always install Bun (it's faster and what the project uses)
    install_bun
fi

# -----------------------------------------
# Ask to install Git if missing (optional)
# -----------------------------------------
if [ "$HAS_GIT" = false ]; then
    echo ""
    read -p "Git is needed for cloning from git. Install it now? [Y/n]: " INSTALL_GIT
    
    if [[ ! "$INSTALL_GIT" =~ ^[Nn]$ ]]; then
        local_pkg_manager=""
        if command -v apt-get &> /dev/null; then
            local_pkg_manager="apt-get"
        elif command -v yum &> /dev/null || command -v dnf &> /dev/null; then
            local_pkg_manager=$(command -v dnf 2>/dev/null || command -v yum)
        else
            local_pkg_manager="apk"
        fi
        install_packages "$local_pkg_manager" git
        HAS_GIT=true
    fi
fi

# -----------------------------------------
# Ask to install MongoDB if missing (optional)
# -----------------------------------------
if [ "$HAS_MONGO" = false ]; then
    echo ""
    read -p "MongoDB is required. Install it now? [Y/n]: " INSTALL_MONGO
    
    if [[ ! "$INSTALL_MONGO" =~ ^[Nn]$ ]]; then
        install_mongodb
        HAS_MONGO=true
    else
        echo ""
        read -p "Enter your external MongoDB URL (mongodb://host:27017/scrumlens): " EXTERNAL_MONGO_URL
        if [ -z "$EXTERNAL_MONGO_URL" ]; then
            echo "ERROR: MongoDB URL is required. Aborting."
            exit 1
        fi
        CUSTOM_MONGO_URL="$EXTERNAL_MONGO_URL"
    fi
fi

echo ""
echo "========================================="
echo "  Pre-check Complete!"
echo "========================================="

# -----------------------------------------
# 1. Create Application User
# -----------------------------------------
echo ""
echo "[1/7] Creating application user..."
if ! id -u scrumlens &>/dev/null; then
    adduser --system --no-create-home --group scrumlens
    echo "  Created user 'scrumlens'"
else
    echo "  User 'scrumlens' already exists"
fi

# -----------------------------------------
# 2. Setup Application Directory
# -----------------------------------------
echo ""
echo "[2/7] Setting up application directory..."
APP_DIR="/opt/scrumlens"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Check if source code is present
if [ ! -f "package.json" ] && [ ! -d ".git" ]; then
    echo "  No source code found in $APP_DIR"
    
    if [ "$HAS_GIT" = true ]; then
        echo ""
        read -p "Would you like to clone from git? [Y/n]: " CLONE_GIT
        
        if [[ ! "$CLONE_GIT" =~ ^[Nn]$ ]]; then
            read -p "Enter repository URL: " GIT_URL
            echo "  Cloning from $GIT_URL ..."
            git clone "$GIT_URL" . 2>/dev/null || {
                echo "ERROR: Git clone failed. Please copy source manually and re-run."
                exit 1
            }
            echo "  Source cloned successfully."
        else
            # Try to find source in common locations
            if [ -f "/tmp/scrumlens/package.json" ]; then
                echo "  Found source in /tmp/scrumlens, copying..."
                cp -r /tmp/scrumlens/* "$APP_DIR/"
            elif [ -f "/root/scrumlens/package.json" ]; then
                echo "  Found source in /root/scrumlens, copying..."
                cp -r /root/scrumlens/* "$APP_DIR/"
            else
                echo ""
                echo "  Please copy the source code using one of these methods:"
                echo ""
                echo "  Method A: From /tmp (if you copied files there first)"
                echo "    cp -r /tmp/scrumlens/* $APP_DIR/"
                echo ""
                echo "  Method B: Using tar transfer"
                echo "    From source machine:"
                echo "      tar -czf scrumlens.tar.gz /path/to/scrumlens"
                echo "    Transfer to container:"
                echo "      scp scrumlens.tar.gz root@<container-ip>:$APP_DIR/"
                echo "    Then extract:"
                echo "      cd $APP_DIR && tar -xzf scrumlens.tar.gz && rm scrumlens.tar.gz"
                echo ""
                
                # Check if tar file exists in common locations
                if [ -f "/tmp/scrumlens.tar.gz" ] || [ -f "$APP_DIR/scrumlens.tar.gz" ]; then
                    TAR_FILE=""
                    if [ -f "/tmp/scrumlens.tar.gz" ]; then
                        TAR_FILE="/tmp/scrumlens.tar.gz"
                    elif [ -f "$APP_DIR/scrumlens.tar.gz" ]; then
                        TAR_FILE="$APP_DIR/scrumlens.tar.gz"
                    fi
                    
                    echo "  Found scrumlens.tar.gz at $TAR_FILE. Extract now? [Y/n]: "
                    read -p "> " EXTRACT_TAR
                    if [[ ! "$EXTRACT_TAR" =~ ^[Nn]$ ]]; then
                        cd "$APP_DIR" && tar -xzf "$TAR_FILE" && rm "$TAR_FILE"
                        echo "  Archive extracted."
                    fi
                fi
                
                if [ ! -f "$APP_DIR/package.json" ]; then
                    echo ""
                    echo "  ERROR: No source code available. Aborting."
                    exit 1
                fi
            fi
        fi
    else
        echo "  Git is not installed. Please copy the source code manually:"
        echo ""
        echo "  Method A: Direct copy"
        echo "    scp -r /local/path/* root@<container-ip>:$APP_DIR/"
        echo ""
        echo "  Method B: Using tar transfer"
        echo "    From source machine:"
        echo "      tar -czf scrumlens.tar.gz /path/to/scrumlens"
        echo "    Transfer to container:"
        echo "      scp scrumlens.tar.gz root@<container-ip>:$APP_DIR/"
        echo "    Then extract in container:"
        echo "      cd $APP_DIR && tar -xzf scrumlens.tar.gz && rm scrumlens.tar.gz"
        echo ""
        
        # Check for archive in common locations
        if [ -f "/tmp/scrumlens/package.json" ]; then
            echo "  Found source in /tmp/scrumlens, copying..."
            cp -r /tmp/scrumlens/* "$APP_DIR/"
        elif [ -f "/root/scrumlens/package.json" ]; then
            echo "  Found source in /root/scrumlens, copying..."
            cp -r /root/scrumlens/* "$APP_DIR/"
        elif [ -f "/tmp/scrumlens.tar.gz" ]; then
            echo "  Found scrumlens.tar.gz in /tmp. Extract now? [Y/n]: "
            read -p "> " EXTRACT_TAR
            if [[ ! "$EXTRACT_TAR" =~ ^[Nn]$ ]]; then
                cd "/tmp" && tar -xzf /tmp/scrumlens.tar.gz -C "$APP_DIR" --strip-components=1 2>/dev/null || \
                cp -r /tmp/scrumlens/* "$APP_DIR/" 2>/dev/null || true
                rm -f /tmp/scrumlens.tar.gz
            fi
        elif [ -f "$APP_DIR/scrumlens.tar.gz" ]; then
            echo "  Found scrumlens.tar.gz in $APP_DIR. Extract now? [Y/n]: "
            read -p "> " EXTRACT_TAR
            if [[ ! "$EXTRACT_TAR" =~ ^[Nn]$ ]]; then
                cd "$APP_DIR" && tar -xzf scrumlens.tar.gz --strip-components=1 && rm scrumlens.tar.gz
            fi
        else
            echo ""
            echo "  ERROR: No source code found. Please copy it and re-run this script."
            exit 1
        fi
    fi
else
    echo "  Source code found in $APP_DIR"
fi

# -----------------------------------------
# 3. Install Dependencies & Build
# -----------------------------------------
echo ""
echo "[3/7] Installing dependencies and building..."
cd "$APP_DIR"

# Find Bun path for this session
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Install server dependencies with bun
echo "  Installing server dependencies with bun..."
cd "$APP_DIR/apps/server" && bun install --frozen || bun install
cd "$APP_DIR"

# Build client (use bun to avoid npm 11.x workspace resolution bug)
echo "  Building client..."
cd "$APP_DIR/apps/client" && bun install --frozen --ignore-scripts && npx nuxt prepare && bun run build && cd "$APP_DIR" || echo "  Warning: Client build had issues, continuing..."

# -----------------------------------------
# 4. Setup MongoDB Service (if not already running)
# -----------------------------------------
echo ""
echo "[4/7] Verifying MongoDB service..."

if [ "$HAS_MONGO" = true ] && [ -z "$CUSTOM_MONGO_URL" ]; then
    # Check if mongod is running
    if systemctl is-active --quiet mongod 2>/dev/null; then
        echo "  MongoDB is already running."
    else
        echo "  Starting MongoDB..."
        systemctl start mongod
        systemctl enable mongod
        echo "  MongoDB started and enabled."
    fi
    
    # Wait for MongoDB to be ready
    echo "  Waiting for MongoDB to be ready..."
    for i in $(seq 1 30); do
        if mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
            echo "  MongoDB is ready!"
            break
        fi
        sleep 1
    done
else
    MONGO_URL="${CUSTOM_MONGO_URL:-mongodb://localhost:27017/scrumlens}"
    echo "  Using external MongoDB URL."
fi

# -----------------------------------------
# 5. Configure Environment
# -----------------------------------------
echo ""
echo "[5/7] Configuring environment..."

ENV_FILE="$APP_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example "$ENV_FILE"
        echo "  Copied .env.example to $ENV_FILE"
    else
        echo "  Creating minimal .env file..."
        
        # Use MongoDB URL (local or external)
        if [ -z "$CUSTOM_MONGO_URL" ]; then
            MONGO_URL="mongodb://localhost:27017/scrumlens"
        else
            MONGO_URL="$CUSTOM_MONGO_URL"
        fi
        
        # Generate a random secret key using node or openssl
        SECRET_KEY=""
        if command -v node &> /dev/null; then
            SECRET_KEY=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
        elif command -v openssl &> /dev/null; then
            SECRET_KEY=$(openssl rand -hex 64)
        else
            SECRET_KEY=$(head -c 128 /dev/urandom | base64 | head -c 64)
        fi
        
        cat > "$ENV_FILE" <<ENVEOF
API_PORT=3000
SECRET_KEY=$SECRET_KEY
MONGO_URL=$MONGO_URL
NODE_ENV=production
CLIENT_URL=http://localhost:3001
ENVEOF
        echo "  Created $ENV_FILE with default values"
    fi
    
    echo ""
    echo "  IMPORTANT: Edit $ENV_FILE to configure:"
    echo "    - MONGO_URL (MongoDB connection, default: mongodb://localhost:27017/scrumlens)"
    echo "    - CLIENT_URL (your domain or IP that students use)"
    echo "    - Email settings (optional, can be left empty)"
else
    echo "  Environment file already exists at $ENV_FILE"
fi

# -----------------------------------------
# 6. Generate/Verify Passwords
# -----------------------------------------
echo ""
echo "[6/7] Setting up team passwords..."

PASSWORDS_FILE="$APP_DIR/passwords.md"

if [ ! -f "$PASSWORDS_FILE" ]; then
    if [ -f "generatePasswords.mjs" ]; then
        node generatePasswords.mjs > "$PASSWORDS_FILE" 2>/dev/null || echo "  WARNING: Password generation failed, copying from /tmp if available..."
        if [ ! -f "$PASSWORDS_FILE" ] || [ ! -s "$PASSWORDS_FILE" ]; then
            if [ -f "/tmp/scrumlens/passwords.md" ]; then
                cp /tmp/scrumlens/passwords.md "$PASSWORDS_FILE"
                echo "  Copied passwords from /tmp/scrumlens/passwords.md"
            else
                echo "  WARNING: Could not generate passwords. Create passwords.md manually."
            fi
        else
            echo "  Generated new passwords at $PASSWORDS_FILE"
        fi
    elif [ -f "/tmp/scrumlens/passwords.md" ]; then
        cp /tmp/scrumlens/passwords.md "$PASSWORDS_FILE"
        echo "  Copied passwords from /tmp/scrumlens/passwords.md"
    else
        echo "  WARNING: No password generation script found."
        echo "  Please copy generatePasswords.mjs and run:"
        echo "    node generatePasswords.mjs > $PASSWORDS_FILE"
        echo ""
        echo "  Or create passwords.md manually with this format:"
        echo "    # Scrumlens Team Passwords"
        echo "    | admin | <password> |"
        echo "    | team1 | <password> |"
        echo "    ..."
    fi
else
    echo "  Passwords file already exists at $PASSWORDS_FILE"
fi

# Secure passwords file
if [ -f "$PASSWORDS_FILE" ]; then
    chmod 600 "$PASSWORDS_FILE"
    chown scrumlens:scrumlens "$PASSWORDS_FILE" 2>/dev/null || true
    echo "  Passwords file secured (chmod 600)"
fi

# -----------------------------------------
# 7. Create Application Systemd Service
# -----------------------------------------
echo ""
echo "[7/7] Creating application systemd service..."

# Find Bun path
BUN_PATH=$(find_bun_path)

if [ -z "$BUN_PATH" ]; then
    echo ""
    echo "ERROR: Bun could not be found. Please install it manually and update the service file."
    echo "  Install Bun with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "  Found Bun at: $BUN_PATH"

# Create systemd service file
cat > /etc/systemd/system/scrumlens.service <<EOF
[Unit]
Description=Scrumlens Retrospective Tool Server
After=network.target mongod.service

[Service]
Type=simple
User=scrumlens
Group=scrumlens
WorkingDirectory=$APP_DIR/apps/server
Environment=NODE_ENV=production
EnvironmentFile=$ENV_FILE
ExecStart=$BUN_PATH run src/index.ts
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

echo "  Created application systemd service at /etc/systemd/system/scrumlens.service"

# -----------------------------------------
# Final Instructions
# -----------------------------------------
echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "ARCHITECTURE:"
echo "  - MongoDB:     mongodb://localhost:27017 (native MongoDB)"
echo "  - Bun:         Application runtime"
echo ""

if [ "$HAS_MONGO" = true ] && [ -z "$CUSTOM_MONGO_URL" ]; then
    echo "SERVICES:"
    echo "  1. MongoDB:     systemctl status mongod"
    echo "  2. Scrumlens:   systemctl status scrumlens"
else
    echo "SERVICES:"
    echo "  1. Scrumlens:   systemctl status scrumlens"
fi
echo ""

echo "NEXT STEPS:"
echo ""
echo "1. Review environment configuration:"
echo "   nano $ENV_FILE"
echo "   Make sure CLIENT_URL matches how students access the app."
echo ""

echo "2. Seed database with admin and team users (first time only):"
echo "   cd $APP_DIR/apps/server && $BUN_PATH run scripts/setupUsers.ts"
echo "   This creates admin + team1-team24 users with random passwords."
echo ""

echo "3. Start the application:"
echo "   systemctl daemon-reload"
echo "   systemctl enable scrumlens"
echo "   systemctl start scrumlens"
echo ""

if [ "$HAS_MONGO" = true ] && [ -z "$CUSTOM_MONGO_URL" ]; then
    echo "4. Start MongoDB (if not started):"
    echo "   systemctl start mongod"
    echo ""
fi

echo "5. Check status:"
echo "   systemctl status scrumlens"
echo ""

echo "6. View logs:"
echo "   journalctl -u scrumlens -f"
echo ""

# Try to detect local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "<container-ip>")
echo "7. Access the application:"
echo "   HTTP: http://$LOCAL_IP:3000"
echo "   Swagger docs: http://$LOCAL_IP:3000/swagger"
echo ""

if [ -f "$PASSWORDS_FILE" ]; then
    echo "8. Team credentials are in: $PASSWORDS_FILE"
    echo "   View with: cat $PASSWORDS_FILE"
fi
echo ""
echo "========================================="