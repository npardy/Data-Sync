@echo off
echo ========================================
echo  Testing Android API Endpoints
echo ========================================
echo.

set /p SERVER=Enter server URL (e.g., http://192.168.1.41:3000): 
set /p JOBPATH=Enter a job path to test (e.g., 25-100-150/25-100/25-100-250807): 
echo.

echo Testing download endpoint...
echo.
curl -s "%SERVER%/api/download-job/%JOBPATH%" | findstr "success files"
echo.

echo.
echo Testing single file download (just headers)...
echo.
curl -I "%SERVER%/api/download-file/%JOBPATH%/job_info.json"
echo.

echo.
echo ========================================
echo If you see "success": true and HTTP 200 OK,
echo the endpoints are working correctly!
echo ========================================
echo.
pause