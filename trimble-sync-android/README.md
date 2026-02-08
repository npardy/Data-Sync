# Trimble Sync Android App

This folder contains the Android app code for full TSC5 integration with file system access.

## Quick Start (WebView Only)

For a quick solution without file system access:
1. Open README.html in your browser
2. Follow the online APK builder instructions

## Features of Full App

- Direct access to /sdcard/Trimble Data/Projects/
- Launch Trimble Access with specific jobs
- Automatic file syncing
- Full screen WebView
- No browser UI

## Files Included

- `MainActivity.java` - Main Android activity with WebView and file system bridge
- `AndroidManifest.xml` - App permissions and configuration
- `README.html` - Visual setup guide

## JavaScript Bridge Methods

The app provides these methods to the web portal:

```javascript
// List all jobs in Trimble Data folder
TrimbleSync.listTrimbleJobs()

// Sync job files to Trimble folder
TrimbleSync.syncJobToTrimble(jobName, filesJson)

// Launch Trimble Access with specific job
TrimbleSync.launchTrimbleAccess(jobPath)
```

## Important Notes

1. Update `TRIMBLE_ACCESS_PACKAGE` in MainActivity.java with the actual package name
2. The app requires Android 6.0+ for permissions
3. File access permissions must be granted manually on Android 11+

## Building the APK

### Option 1: Android Studio
1. Install Android Studio
2. Create new project
3. Copy these files
4. Build and run

### Option 2: Online Builder
Use the simpler web wrapper approach in README.html

## Current Portal URL
http://pardysurveys.direct.quickconnect.to:3000/