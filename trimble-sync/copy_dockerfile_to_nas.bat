@echo off
echo Copying Dockerfile with .NET support to your NAS...
echo.
scp "Z:\Data Sync\trimble-sync\Dockerfile.net" pardysurveys@192.168.1.41:"/volume1/Pardy Surveys/Data Sync/trimble-sync/Dockerfile"
echo.
echo Done! Now go back to PuTTY and run:
echo   sudo docker-compose build --no-cache
echo   sudo docker-compose up -d
echo.
pause