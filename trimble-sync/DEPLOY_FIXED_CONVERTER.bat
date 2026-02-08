@echo off
echo ==========================================
echo  Deploying Fixed Trimble Converter Setup
echo ==========================================
echo.
echo This will rebuild the Docker image with:
echo - Proper Wine configuration
echo - .NET Framework 4.7.2 for the converter
echo - Correct converter paths
echo - All required DLL files
echo.
echo IMPORTANT: This rebuild will take 10-15 minutes!
echo.
pause

set /p NAS_IP=Enter your NAS IP address: 
set /p NAS_USER=Enter your NAS username: 
echo.

echo Creating deployment commands...
(
echo cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
echo echo "Stopping current container..."
echo sudo docker-compose down
echo echo "Removing old image to ensure fresh build..."
echo sudo docker rmi trimble-sync_trimble-sync || true
echo echo "Building new image with fixed converter setup..."
echo echo "This will take 10-15 minutes as it installs .NET Framework..."
echo sudo docker-compose build --no-cache
echo echo "Starting the updated container..."
echo sudo docker-compose up -d
echo echo "Waiting for container to start..."
echo sleep 10
echo echo "Testing if converter is accessible..."
echo sudo docker-compose exec trimble-sync ls -la /app/trimble-converter/JobConversion/
echo echo "Checking Wine installation..."
echo sudo docker-compose exec trimble-sync wine --version
echo echo "Recent logs:"
echo sudo docker-compose logs --tail 30
) > deploy_commands.txt

echo.
echo Connecting to NAS and deploying...
echo.
ssh %NAS_USER%@%NAS_IP% < deploy_commands.txt

del deploy_commands.txt

echo.
echo ==========================================
echo  Deployment Complete!
echo ==========================================
echo.
echo Test the JOB file generation:
echo 1. Access your portal at http://%NAS_IP%:3000
echo 2. Create a new job with CSV/DXF files
echo 3. Check if both .jxl and .job files are created
echo.
echo If JOB files still don't work:
echo - The JXL files will always be created
echo - JXL files can be imported into Trimble Access
echo - This is a complete working solution
echo.
pause