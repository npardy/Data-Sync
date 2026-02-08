# Testing Android Upload Functionality

## Steps to Test Upload

1. **On your TSC5 Controller:**
   - Open the DataSync app
   - Navigate to "TSC5 Local Jobs" section
   - Find a job that has some files (CSV, DXF, or photos)
   - Click the orange upload button (cloud icon)

2. **What to Look For:**
   - You should see a toast message saying "Starting upload..."
   - Watch for progress messages
   - Final message should say "Upload complete! X files uploaded to Field_Data-YYMMDD-HHMM[AM/PM]"

3. **Check Server:**
   - Look in the NAS folder: `Z:\Data Sync\office-jobs\[job-path]\`
   - You should see a new folder named like `Field_Data-250808-0845AM`
   - This folder should contain all the uploaded files

## Debugging Steps

If upload doesn't work:

1. **Check Android Logcat:**
   ```bash
   adb logcat | grep -E "TrimbleSync|MainActivity|Upload"
   ```

2. **Check Server Logs:**
   ```bash
   ssh user@nas
   cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
   sudo docker-compose logs --tail 50
   ```

3. **Verify Endpoint Exists:**
   ```bash
   curl -X POST http://pardysurveys.direct.quickconnect.to:3000/api/upload-field-data-android
   ```
   Should return an error about missing files (not 404)

## Common Issues

1. **404 Error:** Server needs restart to load endpoint
2. **No Toast Messages:** Check JavaScript console in WebView
3. **Files Not Uploading:** Check Android permissions
4. **Network Error:** Verify controller can reach server URL

## Quick Server Restart

If needed, restart server:
```bash
ssh user@nas
cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
sudo docker-compose restart
```