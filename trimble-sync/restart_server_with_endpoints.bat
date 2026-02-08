@echo off
echo ========================================
echo  Restarting Server with Android Endpoints
echo ========================================
echo.
echo This will restart the server with the download endpoints.
echo.

set /p NAS_IP=Enter your NAS IP address: 
set /p NAS_USER=Enter your NAS username: 
echo.

echo Creating restart commands...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "Checking current server status..."
echo sudo docker-compose ps
echo echo "Restarting server to load new endpoints..."
echo sudo docker-compose restart
echo echo "Waiting for server to start..."
echo sleep 10
echo echo "Testing endpoints..."
echo curl -s http://localhost:3000/health
echo echo ""
echo echo "Testing download endpoint..."
echo curl -s "http://localhost:3000/api/download-job/test" | head -20
echo echo ""
echo echo "Server logs:"
echo sudo docker-compose logs --tail 30
) > restart_commands.txt

echo Connecting to NAS and restarting...
ssh %NAS_USER%@%NAS_IP% < restart_commands.txt

del restart_commands.txt

echo.
echo ========================================
echo  Server Restarted!
echo ========================================
echo.
echo The server now has these endpoints:
echo - GET  /api/download-job/{path}
echo - GET  /api/download-file/{path}
echo - POST /api/upload-field-data-android
echo.
echo Try the download button again in your app!
echo.
pause