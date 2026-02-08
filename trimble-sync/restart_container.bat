@echo off
echo ========================================
echo Restarting Trimble Sync Container
echo ========================================
echo.
echo This will restart the container to pick up
echo the latest config changes and volume mounts.
echo.

set /p NAS_IP=Enter your NAS IP address:
set /p NAS_USER=Enter your NAS username:

echo.
echo Creating restart commands...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "=== Stopping container ==="
echo sudo docker-compose down
echo echo ""
echo echo "=== Starting container ==="
echo sudo docker-compose up -d
echo echo ""
echo echo "=== Waiting for startup... ==="
echo sleep 5
echo echo ""
echo echo "=== Container status ==="
echo sudo docker ps ^| grep trimble-sync
echo echo ""
echo echo "=== Checking startup logs ==="
echo sudo docker logs trimble-sync --tail 50
) > restart_commands.txt

echo Connecting to NAS...
ssh %NAS_USER%@%NAS_IP% < restart_commands.txt

del restart_commands.txt

echo.
echo ========================================
echo Container restarted!
echo ========================================
pause
