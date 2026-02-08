@echo off
echo ========================================
echo  Quick Fix for JOB File Generation
echo ========================================
echo.
echo This will attempt to fix the Wine/.NET issue without rebuilding Docker.
echo.
set /p NAS_IP=Enter your NAS IP address: 
set /p NAS_USER=Enter your NAS username: 
echo.

echo Creating fix commands...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "Copying fix script to container..."
echo sudo docker cp wine_fix.sh trimble-sync:/tmp/wine_fix.sh
echo echo "Running fix inside container..."
echo sudo docker-compose exec trimble-sync bash -c "chmod +x /tmp/wine_fix.sh && /tmp/wine_fix.sh"
echo echo "Fix attempt complete. Testing job creation..."
) > fix_commands.txt

echo Connecting to NAS and applying fix...
ssh %NAS_USER%@%NAS_IP% < fix_commands.txt

del fix_commands.txt

echo.
echo ========================================
echo Fix attempt complete!
echo.
echo Please try creating a job with files again.
echo Even if JOB files still don't work, the JXL
echo files should be created successfully.
echo ========================================
echo.
pause