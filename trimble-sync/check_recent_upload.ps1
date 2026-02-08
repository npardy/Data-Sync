# Check recent upload and notification logs

$password = "Backupbitch-95!"
$username = "pardysurveys"
$host_address = "pardysurveys.direct.quickconnect.to"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking Recent Upload Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Last 50 lines of container logs:" -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker logs trimble-sync --tail 50 2>&1"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Filtering for [Notification] messages:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker logs trimble-sync 2>&1 | grep '\[Notification\]' | tail -10"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking events.jsonl file:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$cmd = "cat '/volume1/Pardy Surveys/Data Sync/notifications/events.jsonl' 2>&1 | tail -5"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1
