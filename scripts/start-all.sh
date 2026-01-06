#!/bin/bash
# Start both API and Web servers
echo "Starting CounselTech services..."

# Start API in background
cd apps/api && npx tsx src/index.ts &
API_PID=$!

# Start Web (foreground for Replit workflow)
cd apps/web && npx next dev -p 5000

# Cleanup
kill $API_PID 2>/dev/null
