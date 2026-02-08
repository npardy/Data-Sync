# Restart container with fixed temp directory configuration

$password = "Backupbitch-95!"
$username = "pardysurveys"
$host_address = "pardysurveys.direct.quickconnect.to"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Restarting Container with Temp Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping container..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker-compose down 2>&1"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "Starting container with new temp directory config..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker-compose up -d 2>&1"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "Waiting for startup..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Checking container status..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker ps | grep trimble-sync"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Container restarted!" -ForegroundColor Green
Write-Host "The upload temp directory is now on the same filesystem" -ForegroundColor Green
Write-Host "Try uploading from your Android device again" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
