# Trimble Sync NAS Deployment Script (PowerShell)
# Run this in PowerShell as Administrator

$NAS_IP = Read-Host "Enter your NAS IP address"
$NAS_USER = Read-Host "Enter your NAS username"
$NAS_PATH = "/volume1/Pardy Surveys/Data Sync/trimble-sync"

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host " Deploying Trimble Sync to NAS" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Create deployment script
$commands = @"
cd '$NAS_PATH'
echo 'Stopping current container...'
docker-compose down
echo 'Building new Docker image with Python and Wine...'
docker-compose build
echo 'Starting the updated container...'
docker-compose up -d
echo 'Deployment complete! Recent logs:'
docker-compose logs --tail 20
"@

# Execute via SSH
Write-Host "Connecting to $NAS_USER@$NAS_IP..." -ForegroundColor Yellow
$commands | ssh "$NAS_USER@$NAS_IP"

Write-Host "`n======================================" -ForegroundColor Green
Write-Host " Deployment Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host "`nAccess your portal at: http://${NAS_IP}:3000" -ForegroundColor Green
Write-Host "`nTo view logs, SSH to your NAS and run:" -ForegroundColor Yellow
Write-Host "  cd '$NAS_PATH'" -ForegroundColor White
Write-Host "  docker-compose logs -f" -ForegroundColor White

Read-Host "`nPress Enter to exit"