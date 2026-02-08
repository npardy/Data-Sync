@echo off
echo ========================================
echo  Trimble Sync NAS Deployment Script
echo ========================================
echo.

REM Configuration - UPDATE THESE FOR YOUR NAS
set NAS_IP=YOUR_NAS_IP_HERE
set NAS_USER=YOUR_USERNAME
set NAS_PATH="/volume1/Pardy Surveys/Data Sync/trimble-sync"

echo This script will:
echo 1. Connect to your NAS via SSH
echo 2. Stop the current container
echo 3. Build the new Docker image (Python + Wine)
echo 4. Start the updated container
echo.
echo IMPORTANT: Update NAS_IP and NAS_USER in this script first!
echo.
pause

echo.
echo Connecting to NAS and deploying...
echo.

REM Create a temporary script file for SSH commands
echo cd %NAS_PATH% > deploy_commands.txt
echo docker-compose down >> deploy_commands.txt
echo echo "Building new Docker image with Python and Wine..." >> deploy_commands.txt
echo docker-compose build >> deploy_commands.txt
echo echo "Starting the container..." >> deploy_commands.txt
echo docker-compose up -d >> deploy_commands.txt
echo echo "Deployment complete! Showing logs (press Ctrl+C to exit):" >> deploy_commands.txt
echo docker-compose logs -f >> deploy_commands.txt

REM Execute via SSH (requires SSH client)
echo Running deployment commands on NAS...
ssh %NAS_USER%@%NAS_IP% < deploy_commands.txt

REM Clean up
del deploy_commands.txt

echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Your Trimble Sync server should now be running with:
echo - Python for JXL generation
echo - Wine for JOB conversion
echo.
echo Access your portal at: http://%NAS_IP%:3000
echo.
pause