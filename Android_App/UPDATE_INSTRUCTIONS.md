# Android DataSync App Update Instructions

## What Needs to be Updated

Your Android app is already well-built! Here are the minimal changes needed:

### 1. Add Download Functionality
- Copy `FileDownloadManager.java` to your project
- Update `MainActivity.java` with the changes in `MainActivity_Updates.txt`

### 2. Optional: Update Upload Endpoint
To get timestamped folders (Field_Data-250808-930AM), change:
```java
String url = PORTAL_URL + "/api/upload-field-data";
```
To:
```java
String url = PORTAL_URL + "/api/upload-field-data-android";
```

### 3. Build and Test
1. Open project in Android Studio
2. Sync Gradle files
3. Build and run on your TSC5
4. Test download and upload

## How It Works

### Download Flow:
1. User clicks download button in web UI
2. JavaScript calls `window.TrimbleSync.syncJobToTrimble(jobPath)`
3. Android app:
   - Gets file list from `/api/download-job/{path}`
   - Creates local directories
   - Downloads each file (skips existing .job files)
   - Shows progress
   - Refreshes job list when done

### Upload Flow:
1. User clicks upload button
2. JavaScript calls `window.TrimbleSync.uploadFieldData(jobPath)`
3. Android app:
   - Reads all files from local job folder
   - Uploads to `/api/upload-field-data-android`
   - Server creates timestamped Field_Data folder

## Testing

### Test Download:
1. Create a job on PC with some files
2. Open app on TSC5
3. Find the job and click download
4. Check `/storage/emulated/0/Trimble Data/Projects/` for files

### Test Upload:
1. Add/modify files in a job on TSC5
2. Click upload in the app
3. Check NAS for new `Field_Data-TIMESTAMP` folder

## Server Endpoints

Make sure your server has been updated with the new endpoints:
- `GET /api/download-job/{path}` - Get file list
- `GET /api/download-file/{path}` - Download file
- `POST /api/upload-field-data-android` - Upload with timestamp

## Notes

- The app already handles Android 11+ storage permissions correctly
- WebView JavaScript bridge is already set up
- File upload with progress tracking already works
- Just need to add the download functionality