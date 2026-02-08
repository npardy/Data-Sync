@echo off
echo ========================================
echo  Deploying Android Test Files
echo ========================================
echo.

set /p NAS_IP=Enter your NAS IP address: 
set /p NAS_USER=Enter your NAS username: 
echo.

echo Creating deployment commands...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "Copying updated files..."
echo sudo docker cp public/app.js trimble-sync:/app/public/app.js
echo sudo docker cp test_android.html trimble-sync:/app/public/test_android.html
echo echo "Files updated!"
echo sudo docker-compose restart
echo sleep 5
echo echo "Server restarted"
) > test_deploy_commands.txt

echo Connecting to NAS and deploying...
ssh %NAS_USER%@%NAS_IP% < test_deploy_commands.txt

del test_deploy_commands.txt

echo.
echo ========================================
echo  Test Instructions:
echo ========================================
echo.
echo 1. In your Android app, navigate to:
echo    http://pardysurveys.direct.quickconnect.to:3000/test_android.html
echo.
echo 2. This page will show:
echo    - If Android is detected (should be green)
echo    - What methods are available
echo.
echo 3. Then go back to main page and:
echo    - Check browser console for "Android app detected: true"
echo    - Look for Download buttons on ALL folders now
echo.
pause