@echo off
echo ========================================
echo  Checking Trimble Sync Logs on NAS
echo ========================================
echo.
echo This script will help you check the logs on your NAS to see why the JOB file isn't being created.
echo.
echo Please enter your NAS connection details:
echo.
set /p NAS_IP=Enter your NAS IP address (e.g., 192.168.1.41): 
set /p NAS_USER=Enter your NAS username: 
echo.
echo Connecting to your NAS to check logs...
echo.
echo ========================================
echo COMMANDS TO RUN ON YOUR NAS:
echo ========================================
echo.
echo 1. First, check if the container is running:
echo    cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo    sudo docker-compose ps
echo.
echo 2. Check the recent logs:
echo    sudo docker-compose logs --tail 50
echo.
echo 3. Check specifically for Wine/converter errors:
echo    sudo docker-compose logs | grep -E "(Wine|wine|converter|JOB|job|error|Error|Python|python)" | tail -50
echo.
echo 4. Check if Wine is installed in the container:
echo    sudo docker-compose exec trimble-sync wine --version
echo.
echo 5. Check if the Python script can run:
echo    sudo docker-compose exec trimble-sync python3 /app/trimble-converter/jxl_generator.py --help
echo.
echo ========================================
echo.
echo Now connecting to your NAS via SSH...
echo.
ssh %NAS_USER%@%NAS_IP%
pause