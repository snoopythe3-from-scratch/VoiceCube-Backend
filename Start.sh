#!/bin/bash
# ============================================================
#  Voice Relay Start Script
#  Runs voice-relay.js with auto-restart + .env loading
# ============================================================

RELAY_FILE="voice-relay.js"
LOG_FILE="relay.log"

# ------------------------------------------------------------
# 1) Ensure Node is installed
# ------------------------------------------------------------
if ! command -v node > /dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed. Please install Node.js." >&2
    exit 1
fi

# ------------------------------------------------------------
# 2) Ensure required file exists
# ------------------------------------------------------------
if [ ! -f "$RELAY_FILE" ]; then
    echo "[ERROR] $RELAY_FILE not found in current directory." >&2
    exit 1
fi

# ------------------------------------------------------------
# 3) Load .env if present
# ------------------------------------------------------------
if [ -f ".env" ]; then
    echo "[INFO] Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
fi

# ------------------------------------------------------------
# 4) Install dependencies if needed
# ------------------------------------------------------------
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing Node dependencies..."
    npm install
fi

# ------------------------------------------------------------
# 5) If PM2 is installed, use it (recommended)
# ------------------------------------------------------------
if command -v pm2 > /dev/null 2>&1; then
    echo "[INFO] PM2 detected — starting with PM2"
    pm2 start "$RELAY_FILE" --name voice-relay --time
    pm2 save
    exit 0
fi

# ------------------------------------------------------------
# 6) Fallback: simple auto-restart loop
# -------------------
