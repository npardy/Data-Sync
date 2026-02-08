@echo off
echo ========================================
echo  Testing Converter After Deployment
echo ========================================
echo.

set /p NAS_IP=Enter your NAS IP address: 
set /p NAS_USER=Enter your NAS username: 
echo.

echo Creating test commands...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "Copying test script to container..."
echo sudo docker cp test_converter.sh trimble-sync:/tmp/test_converter.sh
echo echo "Running converter tests..."
echo sudo docker-compose exec trimble-sync bash /tmp/test_converter.sh
echo echo "Testing job file generation endpoint..."
echo sudo docker-compose exec trimble-sync curl -s http://localhost:3000/api/test-jxl
) > test_commands.txt

echo.
echo Running tests on NAS...
echo.
ssh %NAS_USER%@%NAS_IP% < test_commands.txt

del test_commands.txt

echo.
echo ========================================
echo Test complete!
echo.
echo If you see "SUCCESS: Test JOB file created!"
echo then the converter is working properly.
echo.
echo Next step: Try creating a job with files
echo in the web interface.
echo ========================================
echo.
pause