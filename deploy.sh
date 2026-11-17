#!/usr/bin/env bash
set -euo pipefail

# --- Load Node.js version 20 via nvm ---
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20
# ---------------------------------------

# Define directories
ROOT_DIR="/home/developer/apps/talknova.ai"
TMP_DIR="$ROOT_DIR/tmp"
APP_DIR="$ROOT_DIR/app"
PUBLIC_DIR="$ROOT_DIR/public"

# Navigate to the cloned repository
cd "$TMP_DIR"

# Pull the latest changes from the main branch
git pull --ff-only origin main

# Synchronize existing files in the 'app' directory
sudo rsync -av --existing --no-perms --no-owner --no-group "$TMP_DIR/app/" "$APP_DIR/"

# Synchronize existing files in the 'public' directory
sudo rsync -av --existing --no-perms --no-owner --no-group "$TMP_DIR/public/" "$PUBLIC_DIR/"

# Install dependencies and build the project
cd "$ROOT_DIR"
npm ci
npm run build

# Restart the application using PM2
pm2 restart talknova-ai
