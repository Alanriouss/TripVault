#!/usr/bin/env bash
set -e

echo "=================================================="
echo "           TRIPVAULT - DEMO LAUNCHER              "
echo "=================================================="

# 1. Locate Bun runtime
BUN_CMD="bun"
if ! command -v bun &> /dev/null; then
    if [ -f "$HOME/.bun/bin/bun" ]; then
        BUN_CMD="$HOME/.bun/bin/bun"
    else
        echo "Bun runtime not found. Installing Bun..."
        curl -fsSL https://bun.com/install | bash
        BUN_CMD="$HOME/.bun/bin/bun"
    fi
fi

# 2. Determine Port
PORT=8788
if lsof -Pi :8788 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    PORT=8789
    echo "Port 8788 is busy. Switching to port 8789."
fi

export TRIPVAULT_PORT="$PORT"
DEMO_URL="http://127.0.0.1:$PORT/?demo=1"

echo "Starting TripVault Server on port $PORT..."
echo "Demo URL: $DEMO_URL"

# Open browser
if command -v open &> /dev/null; then
    open "$DEMO_URL" &
elif command -v xdg-open &> /dev/null; then
    xdg-open "$DEMO_URL" &
fi

echo "Server is running! Press Ctrl+C in this terminal to stop."
exec "$BUN_CMD" "outputs/TripVault_Room_Server.mjs"
