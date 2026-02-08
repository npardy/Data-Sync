@echo off
echo ========================================
echo  Simple Deploy Steps
echo ========================================
echo.
echo Follow these steps in PuTTY:
echo.
echo 1. Connect to your NAS:
echo    ssh pardysurveys@192.168.1.41
echo.
echo 2. Run these commands one by one:
echo.
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo sudo docker-compose down
echo sudo docker-compose build --no-cache
echo sudo docker-compose up -d
echo.
echo 3. Check if it worked:
echo    sudo docker-compose logs --tail 30
echo.
echo The build command will take 10-15 minutes!
echo Don't close PuTTY during the build.
echo.
pause