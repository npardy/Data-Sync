@echo off
echo ========================================
echo Notification System Diagnostics
echo ========================================
echo.

set /p NAS_IP=Enter your NAS IP address:
set /p NAS_USER=Enter your NAS username:

echo.
echo Creating diagnostic commands...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "=== 1. Checking if container is running ==="
echo sudo docker ps ^| grep trimble-sync
echo echo ""
echo echo "=== 2. Checking NOTIFICATIONS_ENABLED inside container ==="
echo sudo docker exec trimble-sync node -e "const config = require('./config'); console.log('NOTIFICATIONS_ENABLED:', config.NOTIFICATIONS_ENABLED);"
echo echo ""
echo echo "=== 3. Checking if /data/notifications exists in container ==="
echo sudo docker exec trimble-sync ls -la /data/notifications
echo echo ""
echo echo "=== 4. Searching logs for [Notification] messages ==="
echo sudo docker logs trimble-sync 2^^^>^^^&1 ^| grep -i notification
echo echo ""
echo echo "=== 5. Last 30 lines of container logs ==="
echo sudo docker logs trimble-sync --tail 30
echo echo ""
echo echo "=== 6. Checking if events.jsonl exists on host ==="
echo ls -lh "/volume1/Pardy Surveys/Data Sync/notifications/events.jsonl"
) > notification_check_commands.txt

echo Connecting to NAS...
ssh %NAS_USER%@%NAS_IP% < notification_check_commands.txt

del notification_check_commands.txt

echo.
echo ========================================
echo Diagnostics complete!
echo ========================================
pause
