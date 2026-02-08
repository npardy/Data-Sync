# PowerShell script to restart container and verify notifications

$password = "Backupbitch-95!"
$username = "pardysurveys"
$host_address = "pardysurveys.direct.quickconnect.to"

function Run-SSHCommand {
    param($command)
    $sudoCommand = "echo '$password' | sudo -S $command"
    $fullCommand = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && $sudoCommand"
    echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $fullCommand 2>&1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Restarting Trimble Sync Container" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Stopping container..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker-compose down"

Write-Host ""
Write-Host "2. Starting container with new environment variables..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker-compose up -d"

Write-Host ""
Write-Host "3. Waiting for container to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "4. Verifying container is running..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker ps | grep trimble-sync"

Write-Host ""
Write-Host "5. Checking NOTIFICATIONS_ENABLED (should be true now)..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker exec trimble-sync node -e \`"const config = require('./config'); console.log('NOTIFICATIONS_ENABLED:', config.NOTIFICATIONS_ENABLED);\`""

Write-Host ""
Write-Host "6. Checking startup logs for feature flags..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker logs trimble-sync 2>&1 | grep -E 'Streaming mode|NOTIFICATIONS_ENABLED|Notification'"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Container restarted!" -ForegroundColor Green
Write-Host "Now do a test upload and check for notifications" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
