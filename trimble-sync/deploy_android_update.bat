@echo off
echo ========================================
echo  Deploying Android API Updates
echo ========================================
echo.
echo This will update the server with new Android endpoints:
echo - Download job files
echo - Upload with timestamp folders
echo.

set /p NAS_IP=Enter your NAS IP address: 
set /p NAS_USER=Enter your NAS username: 
echo.

echo Creating deployment commands...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "Restarting server with new Android endpoints..."
echo sudo docker-compose restart
echo echo "Waiting for server to start..."
echo sleep 5
echo echo "Checking server status..."
echo sudo docker-compose ps
echo echo "Testing new endpoints..."
echo curl -s http://localhost:3000/health
echo echo ""
echo echo "New endpoints available:"
echo echo "- GET  /api/download-job/{path} - List files in job"
echo echo "- GET  /api/download-file/{path} - Download single file"  
echo echo "- POST /api/upload-field-data-android - Upload with timestamp"
echo echo ""
echo echo "Server logs:"
echo sudo docker-compose logs --tail 20
) > android_deploy_commands.txt

echo Connecting to NAS and deploying...
ssh %NAS_USER%@%NAS_IP% < android_deploy_commands.txt

del android_deploy_commands.txt

echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Android API endpoints are now available:
echo.
echo Download: http://%NAS_IP%:3000/api/download-job/[job-path]
echo Upload: http://%NAS_IP%:3000/api/upload-field-data-android
echo.
echo See ANDROID_API_DOCUMENTATION.md for details.
echo.
pause