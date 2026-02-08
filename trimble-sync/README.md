# Trimble Sync Portal - Setup Guide

## Quick Setup for Synology NAS

### Step 1: Install Docker Package
1. Open Package Center on your Synology
2. Search for "Docker" (or "Container Manager" in DSM 7.1+)
3. Install it if not already installed

### Step 2: Download Node.js Image
1. Open Docker/Container Manager
2. Go to Registry (left sidebar)
3. Search for "node"
4. Download the image with tag: `node:18-alpine`

### Step 3: Deploy Using Docker Compose
1. In Docker/Container Manager, go to "Project" (left sidebar)
2. Click "Create"
3. Give it a name: "trimble-sync"
4. Upload the docker-compose.yml file from this folder
5. Click "Next" and "Done"

### Step 4: Upload Template Files
Upload these files to `/volume1/Pardy Surveys/Data Sync/templates/`:
- TMNT Z1.jxl (your Trimble job template)
- Control Avalon 241007.csv (your control file)

### Step 5: Access the Portal
- Local network: http://192.168.1.41:3000
- QuickConnect: Will set up reverse proxy next

## Folder Structure Created
```
Data Sync/
├── trimble-sync/         # Application files
├── office-jobs/          # Jobs on office side
├── controller-jobs/      # Mirror of TSC5 jobs
└── templates/           # JXL and control templates
```

## Remote Access Setup (Next Steps)

### Option 1: QuickConnect Reverse Proxy
1. Go to Control Panel > Application Portal > Reverse Proxy
2. Create new rule:
   - Description: Trimble Sync
   - Source Protocol: HTTPS
   - Source Hostname: *.quickconnect.to
   - Source Port: 443
   - Destination Protocol: HTTP
   - Destination Hostname: localhost
   - Destination Port: 3000

### Option 2: VPN Access
1. Set up Synology VPN Server
2. Configure TSC5 to connect via VPN
3. Access using internal IP: http://192.168.1.41:3000

## Testing
1. Open browser to http://192.168.1.41:3000
2. You should see the Trimble Sync interface
3. Try creating a test job
4. Check if files appear in office-jobs folder

## Troubleshooting
- If container won't start: Check Docker logs
- If can't access: Verify firewall allows port 3000
- If files don't save: Check folder permissions in DSM

## Next Steps
1. Configure remote access for TSC5
2. Set up Android app or browser bookmark on TSC5
3. Test sync functionality
4. Configure automatic backups