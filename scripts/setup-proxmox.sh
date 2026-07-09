#!/bin/bash
#!/bin/bash
# =====================================================
# Scrumlens - Proxmox LXC Base Setup Script
# Prepares Debian/Ubuntu LXC and then hands off to
# deploy-existing-container.sh for application deployment.
# =====================================================

set -e

echo "========================================="
echo "  Scrumlens Proxmox Base Setup"
echo "========================================="

echo "[1/5] Updating system packages..."
apt-get update -y
apt-get upgrade -y

echo "[2/5] Installing base dependencies..."
apt-get install -y curl git ca-certificates openssl nginx gnupg

echo "[3/5] Installing Node.js 20 LTS (tooling support)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "[4/5] Installing Bun runtime..."
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

echo "[5/5] Base setup complete."

echo ""
echo "Next: run deployment script inside container:"
echo "  chmod +x /opt/scrumlens/scripts/deploy-existing-container.sh"
echo "  /opt/scrumlens/scripts/deploy-existing-container.sh"
echo ""
echo "If source is not yet in /opt/scrumlens, copy it first."