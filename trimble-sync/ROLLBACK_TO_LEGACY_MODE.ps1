# ROLLBACK: Disable streaming mode and revert to legacy upload mode
# This will restore the old behavior (memory-based uploads)

$password = "Backupbitch-95!"
$username = "pardysurveys"
$host_address = "pardysurveys.direct.quickconnect.to"

Write-Host "========================================" -ForegroundColor Red
Write-Host "ROLLING BACK TO LEGACY MODE" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "This will disable streaming mode and restore old upload behavior" -ForegroundColor Yellow
Write-Host "Notifications will still work" -ForegroundColor Yellow
Write-Host ""

$continue = Read-Host "Are you sure you want to rollback? (yes/no)"
if ($continue -ne "yes") {
    Write-Host "Cancelled" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Creating backup of current docker-compose.yml..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && cp docker-compose.yml docker-compose.yml.backup-$(date +%Y%m%d-%H%M%S)"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "Updating docker-compose.yml to disable streaming..." -ForegroundColor Yellow
$cmd = @"
cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && cat > docker-compose.yml.tmp << 'EOFCONFIG'
version: '3'

services:
  trimble-sync:
    build: .
    container_name: trimble-sync
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - "/volume1/Pardy Surveys/Data Sync/trimble-sync:/app"
      - "/volume1/Pardy Surveys/Data Sync/office-jobs:/data/office"
      - "/volume1/Pardy Surveys/Data Sync/controller-jobs:/data/controller"
      - "/volume1/Pardy Surveys/Data Sync/templates:/data/templates"
      - "/volume1/Pardy Surveys/Data Sync/notifications:/data/notifications"
    working_dir: /app
    environment:
      - NODE_ENV=production
      - TZ=America/St_Johns
      - WINEDEBUG=-all
      - DISPLAY=:0
      - PORT=3000
      # LEGACY MODE: All features disabled except notifications
      - UPLOAD_STREAMING_ENABLED=false
      - UPLOAD_PROGRESS_API=false
      - UPLOAD_CHECKSUM_ENABLED=false
      - UPLOAD_IDEMPOTENCY_ENABLED=false
      - UPLOAD_RESUME_ENABLED=false
      - SERVER_TIMEOUT_MS=120000
      - SERVER_KEEPALIVE_MS=65000
      - UPLOAD_TEMP_DIR=/tmp/uploads
      - UPLOAD_PARTIAL_DIR=/tmp/uploads-partial
      - UPLOAD_MAX_FILE_MB=100
      - IDEMPOTENCY_STORE_PATH=/app/upload-idempotency.json
      - HOST_REDIRECTS_ENABLED=false
      - HOST_REDIRECTS_LEGACY_HOSTS=pardysurveys.direct.quickconnect.to,pardysurveys.direct.quickconnect.to:3000
      - HOST_REDIRECTS_TARGET_HOST=pardysurveys.synology.me
      - HOST_REDIRECTS_TARGET_PROTO=https
      # Notification system (ENABLED)
      - NOTIFICATIONS_ENABLED=true
EOFCONFIG
mv docker-compose.yml.tmp docker-compose.yml
"@
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "Restarting container with legacy mode..." -ForegroundColor Yellow
$cmd = "cd '/volume1/Pardy Surveys/Data Sync/trimble-sync' && echo '$password' | sudo -S /usr/local/bin/docker-compose down && echo '$password' | sudo -S /usr/local/bin/docker-compose up -d"
echo $password | ssh -o StrictHostKeyChecking=no "$username@$host_address" $cmd 2>&1

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "ROLLBACK COMPLETE" -ForegroundColor Green
Write-Host "System restored to legacy memory-based upload mode" -ForegroundColor Green
Write-Host "Notifications are still enabled" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
