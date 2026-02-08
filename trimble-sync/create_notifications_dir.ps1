# PowerShell script to create notifications directory and restart container

$password = "Backupbitch-95!"
$username = "pardysurveys"
$host_address = "pardysurveys.direct.quickconnect.to"

function Run-SSHCommand {
    param($command)
    $sudoCommand = "echo '$password' | sudo -S $command"
    $fullCommand = "$sudoCommand"
    echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $fullCommand 2>&1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Creating Notifications Directory" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Creating /volume1/Pardy Surveys/Data Sync/notifications directory..." -ForegroundColor Yellow
Run-SSHCommand "mkdir -p '/volume1/Pardy Surveys/Data Sync/notifications'"

Write-Host ""
Write-Host "2. Verifying directory was created..." -ForegroundColor Yellow
Run-SSHCommand "ls -la '/volume1/Pardy Surveys/Data Sync/' | grep notifications"

Write-Host ""
Write-Host "3. Restarting container..." -ForegroundColor Yellow
Run-SSHCommand "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && /usr/local/bin/docker-compose up -d"

Write-Host ""
Write-Host "4. Waiting for container to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "5. Checking container status..." -ForegroundColor Yellow
Run-SSHCommand "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && /usr/local/bin/docker ps | grep trimble-sync"

Write-Host ""
Write-Host "6. Verifying NOTIFICATIONS_ENABLED=true..." -ForegroundColor Yellow
Run-SSHCommand "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && /usr/local/bin/docker exec trimble-sync node -e \`"const config = require('./config'); console.log('NOTIFICATIONS_ENABLED:', config.NOTIFICATIONS_ENABLED);\`""

Write-Host ""
Write-Host "7. Checking /data/notifications exists in container..." -ForegroundColor Yellow
Run-SSHCommand "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && /usr/local/bin/docker exec trimble-sync ls -la /data/notifications"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "Now do a test upload to verify notifications work" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
