# PowerShell script to verify notifications after test upload

$password = "Backupbitch-95!"
$username = "pardysurveys"
$host_address = "pardysurveys.direct.quickconnect.to"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verifying Notification System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Searching container logs for [Notification] messages..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker logs trimble-sync 2>&1 | grep -i '\[Notification\]' | tail -20"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "2. Checking if events.jsonl was created..." -ForegroundColor Yellow
$cmd = "ls -lh '/volume1/Pardy Surveys/Data Sync/notifications/events.jsonl' 2>&1"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "3. If events.jsonl exists, showing first 5 events..." -ForegroundColor Yellow
$cmd = "if [ -f '/volume1/Pardy Surveys/Data Sync/notifications/events.jsonl' ]; then head -5 '/volume1/Pardy Surveys/Data Sync/notifications/events.jsonl'; else echo 'File does not exist yet - do a test upload first'; fi"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "4. Last 10 lines of container logs..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker logs trimble-sync --tail 10 2>&1"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Verification complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
