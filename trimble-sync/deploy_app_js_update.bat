@echo off
echo ========================================
echo  Deploying app.js Updates
echo ========================================
echo.
echo This will update the web interface with:
echo - Download buttons for job folders
echo - Download progress callbacks
echo.

set /p NAS_IP=Enter your NAS IP address: 
set /p NAS_USER=Enter your NAS username: 
echo.

echo Creating deployment commands...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "Updating app.js..."
echo sudo docker cp public/app.js trimble-sync:/app/public/app.js
echo echo "Restarting container to ensure changes take effect..."
echo sudo docker-compose restart
echo echo "Waiting for server to start..."
echo sleep 5
echo echo "Update complete!"
echo sudo docker-compose ps
) > app_deploy_commands.txt

echo Connecting to NAS and deploying...
ssh %NAS_USER%@%NAS_IP% < app_deploy_commands.txt

del app_deploy_commands.txt

echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Changes:
echo 1. Job folders now have Download buttons in Android app
echo 2. Download progress will show alerts
echo 3. TSC5 job list refreshes after download
echo.
echo Test by:
echo 1. Refresh the app on your controller
echo 2. Look for blue "Download" buttons on job folders
echo 3. Click to download entire job folder
echo.
pause