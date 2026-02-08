#!/bin/bash
cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"

echo "=== 1. Checking if container is running ==="
docker ps | grep trimble-sync || echo "Container not found without sudo, trying with sudo..."
echo "Backupbitch-95!" | sudo -S docker ps 2>/dev/null | grep trimble-sync

echo ""
echo "=== 2. Checking NOTIFICATIONS_ENABLED inside container ==="
docker exec trimble-sync node -e "const config = require('./config'); console.log('NOTIFICATIONS_ENABLED:', config.NOTIFICATIONS_ENABLED);" 2>/dev/null || \
echo "Backupbitch-95!" | sudo -S docker exec trimble-sync node -e "const config = require('./config'); console.log('NOTIFICATIONS_ENABLED:', config.NOTIFICATIONS_ENABLED);"

echo ""
echo "=== 3. Checking if /data/notifications exists in container ==="
docker exec trimble-sync ls -la /data/notifications 2>/dev/null || \
echo "Backupbitch-95!" | sudo -S docker exec trimble-sync ls -la /data/notifications

echo ""
echo "=== 4. Searching logs for [Notification] messages (last 200 lines) ==="
docker logs trimble-sync --tail 200 2>&1 | grep -i notification || echo "No notification logs found"

echo ""
echo "=== 5. Checking if events.jsonl exists on host ==="
ls -lh "/volume1/Pardy Surveys/Data Sync/notifications/events.jsonl" 2>/dev/null || echo "events.jsonl does not exist yet"

echo ""
echo "=== 6. Last 30 lines of container logs ==="
docker logs trimble-sync --tail 30 2>&1 || echo "Backupbitch-95!" | sudo -S docker logs trimble-sync --tail 30 2>&1
