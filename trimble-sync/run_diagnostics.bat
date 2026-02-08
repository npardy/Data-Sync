@echo off
echo ========================================
echo  Running Diagnostics on Trimble Sync
echo ========================================
echo.
echo This will help identify why JOB files aren't being created.
echo.
set /p NAS_IP=Enter your NAS IP address: 
set /p NAS_USER=Enter your NAS username: 
echo.
echo Creating SSH commands file...

echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync" > diagnostic_commands.txt
echo sudo docker-compose exec trimble-sync bash -c "python3 --version; wine --version" >> diagnostic_commands.txt
echo echo "Checking converter executable:" >> diagnostic_commands.txt
echo sudo docker-compose exec trimble-sync ls -la /app/trimble-converter/JobConversion/TrimbleAccess.JobConverter.ConverterProcess.exe >> diagnostic_commands.txt
echo echo "Testing Wine with converter:" >> diagnostic_commands.txt
echo sudo docker-compose exec trimble-sync bash -c "cd /app/trimble-converter/JobConversion && wine TrimbleAccess.JobConverter.ConverterProcess.exe --help" >> diagnostic_commands.txt
echo echo "Checking recent logs for errors:" >> diagnostic_commands.txt
echo sudo docker-compose logs --tail 20 ^| grep -i error >> diagnostic_commands.txt

echo.
echo Connecting to NAS...
ssh %NAS_USER%@%NAS_IP% < diagnostic_commands.txt

del diagnostic_commands.txt

echo.
echo ========================================
echo If Wine is not working properly, the JXL files
echo should still be created and can be imported
echo directly into Trimble Access.
echo ========================================
echo.
pause