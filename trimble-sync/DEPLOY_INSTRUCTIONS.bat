@echo off
echo ========================================
echo  Trimble Sync NAS Deployment Steps
echo ========================================
echo.
echo This will guide you through deploying the updated server to your NAS.
echo.
echo STEP 1: Access your NAS
echo -----------------------
echo Use one of these methods:
echo   a) SSH from Windows: ssh admin@[YOUR-NAS-IP]
echo   b) Use the Terminal in your NAS web interface (DSM)
echo   c) Use PuTTY or another SSH client
echo.
pause

cls
echo STEP 2: Run these commands on your NAS
echo --------------------------------------
echo Copy and paste these commands one by one:
echo.
echo 1. Navigate to the project:
echo    cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo.
echo 2. Stop the current container:
echo    docker-compose down
echo.
echo 3. Build the new image (this takes 5-10 minutes):
echo    docker-compose build
echo.
echo 4. Start the updated container:
echo    docker-compose up -d
echo.
echo 5. Check if it's working:
echo    docker-compose logs --tail 50
echo.
pause

cls
echo STEP 3: Test the deployment
echo ---------------------------
echo.
echo 1. Open your browser to: http://[YOUR-NAS-IP]:3000
echo 2. Create a test job with some files
echo 3. Check if both JXL and JOB files are created
echo.
echo If JOB files aren't created, check the logs:
echo    docker-compose logs -f
echo.
echo The server will still create JXL files even if Wine fails.
echo JXL files can be imported directly into Trimble Access.
echo.
pause

cls
echo TROUBLESHOOTING
echo ---------------
echo.
echo If the build fails:
echo - Make sure Docker is running on your NAS
echo - Check available disk space
echo - Try: docker system prune -a (removes old images)
echo.
echo If Wine doesn't work properly:
echo - The JXL files will still be created
echo - You can convert JXL to JOB on Windows later
echo - Or import JXL directly into Trimble Access
echo.
echo To see what's happening:
echo    docker-compose logs -f
echo.
echo To restart the container:
echo    docker-compose restart
echo.
pause