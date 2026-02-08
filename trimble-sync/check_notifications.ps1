# PowerShell script to check notification system on NAS

$password = "Backupbitch-95!"
$username = "pardysurveys"
$host_address = "pardysurveys.direct.quickconnect.to"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Notification System Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to run SSH command with sudo
function Run-SSHCommand {
    param($command)
    $sudoCommand = "echo '$password' | sudo -S $command"
    $fullCommand = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && $sudoCommand"
    echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $fullCommand 2>&1
}

Write-Host "1. Checking if container is running..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker ps | grep trimble-sync"

Write-Host ""
Write-Host "2. Checking NOTIFICATIONS_ENABLED inside container..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker exec trimble-sync node -e \`"const config = require('./config'); console.log('NOTIFICATIONS_ENABLED:', config.NOTIFICATIONS_ENABLED);\`""

Write-Host ""
Write-Host "3. Checking if /data/notifications exists in container..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker exec trimble-sync ls -la /data/notifications"

Write-Host ""
Write-Host "4. Searching logs for [Notification] messages..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker logs trimble-sync 2>&1 | grep -i notification | tail -20"

Write-Host ""
Write-Host "5. Checking if events.jsonl exists on host..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && ls -lh '/volume1/Pardy Surveys/Data Sync/notifications/events.jsonl' 2>&1"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "6. Last 50 lines of container logs..." -ForegroundColor Yellow
Run-SSHCommand "/usr/local/bin/docker logs trimble-sync --tail 50 2>&1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Diagnostics complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
