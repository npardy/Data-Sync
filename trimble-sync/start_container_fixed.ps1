# PowerShell script to start container with notifications enabled

$password = "Backupbitch-95!"
$username = "pardysurveys"
$host_address = "pardysurveys.direct.quickconnect.to"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Container with Notifications" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Starting container..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker-compose up -d 2>&1"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "2. Waiting for startup..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "3. Checking container status..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker ps | grep trimble-sync"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "4. Verifying NOTIFICATIONS_ENABLED=true..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker exec trimble-sync node -e `"const config = require('./config'); console.log('NOTIFICATIONS_ENABLED:', config.NOTIFICATIONS_ENABLED);`""
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "5. Checking /data/notifications in container..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker exec trimble-sync ls -la /data/notifications"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "6. Viewing startup logs (feature flags)..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker logs trimble-sync 2>&1 | tail -30"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Container started!" -ForegroundColor Green
Write-Host "Do a test upload and check logs:" -ForegroundColor Green
Write-Host "  docker logs trimble-sync | grep Notification" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
