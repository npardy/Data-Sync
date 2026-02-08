@echo off
echo Checking server logs for errors...
echo.

set /p NAS_IP=Enter your NAS IP address: 
set /p NAS_USER=Enter your NAS username: 

echo.
echo Creating command file...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "=== Checking Docker container status ==="
echo sudo docker-compose ps
echo echo ""
echo echo "=== Recent server logs ==="
echo sudo docker-compose logs --tail 50 ^| grep -E "error|Error|ERROR|failed|Failed"
echo echo ""
echo echo "=== Last 20 server log entries ==="
echo sudo docker-compose logs --tail 20
) > check_logs_commands.txt

echo Connecting to NAS...
ssh %NAS_USER%@%NAS_IP% < check_logs_commands.txt

del check_logs_commands.txt

echo.
echo Done!
pause