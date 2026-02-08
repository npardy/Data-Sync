# Android API Documentation for Trimble Sync

## Base URL
```
http://pardysurveys.direct.quickconnect.to:3000/
```

## Android Download Workflow

### 1. Get Job File List
**Endpoint**: `GET /api/download-job/{jobPath}`

**Example**:
```
GET /api/download-job/25-100-150/25-100/25-100-250807/
```

**Response**:
```json
{
  "success": true,
  "jobPath": "25-100-150/25-100/25-100-250807/",
  "baseUrl": "http://pardysurveys.direct.quickconnect.to:3000/api/download-file/",
  "files": [
    {
      "name": "25-100.job",
      "path": "25-100.job",
      "size": 12543,
      "modified": "2025-08-08T10:30:00Z"
    },
    {
      "name": "25-100.jxl",
      "path": "25-100.jxl",
      "size": 35421,
      "modified": "2025-08-08T10:30:00Z"
    },
    {
      "name": "layout.csv",
      "path": "layout.csv",
      "size": 2341,
      "modified": "2025-08-08T10:30:00Z"
    }
  ]
}
```

### 2. Download Individual Files
**Endpoint**: `GET /api/download-file/{fullFilePath}`

**Example**:
```
GET /api/download-file/25-100-150/25-100/25-100-250807/25-100.job
```

**Response**: Binary file data

**Android Implementation**:
1. Call download-job to get file list
2. For each file, download to: `/storage/emulated/0/Trimble Data/Projects/{jobPath}/{fileName}`
3. Create directories as needed
4. Skip .job file if it already exists (as requested)

## Android Upload Workflow

### Upload Field Data with Timestamp
**Endpoint**: `POST /api/upload-field-data-android`

**Headers**:
```
Content-Type: multipart/form-data
```

**Form Data**:
- `jobPath`: The relative job path (e.g., "25-100-150/25-100/25-100-250807/")
- `files`: Multiple file uploads

**Example Response**:
```json
{
  "success": true,
  "fieldDataPath": "25-100-150/25-100/25-100-250807/Field_Data-250808-930AM",
  "folder": "Field_Data-250808-930AM",
  "filesUploaded": 5,
  "files": [
    {"name": "photo1.jpg", "size": 2341234},
    {"name": "export.csv", "size": 12421},
    {"name": "modified.jxl", "size": 35678}
  ]
}
```

**Android Implementation**:
1. Read all files from local job directory
2. Create multipart request with jobPath
3. Upload all files (including subdirectories)
4. Server creates timestamped Field_Data folder

## JavaScript Bridge (Already Implemented in Web UI)

The web interface expects these methods from the Android WebView:

```javascript
window.TrimbleSync = {
  // List jobs on the TSC5
  listTrimbleJobs: function() {
    // Return JSON with job structure
  },
  
  // Download job from NAS to TSC5
  downloadJob: function(nasPath) {
    // Use the download-job API
    // Save to /storage/emulated/0/Trimble Data/Projects/...
  },
  
  // Upload field data from TSC5 to NAS
  uploadFieldData: function(localPath) {
    // Use the upload-field-data-android API
    // Upload all files from local job folder
  },
  
  // Launch Trimble Access with job
  launchTrimbleAccess: function(jobPath) {
    // Open Trimble Access app with specific job
  },
  
  // Request storage permissions
  requestStorageAccess: function() {
    // Trigger Android storage permission dialog
  }
};
```

## Example Android Code (Kotlin)

### WebView Setup
```kotlin
webView.addJavascriptInterface(TrimbleSyncInterface(this), "TrimbleSync")
webView.loadUrl("http://pardysurveys.direct.quickconnect.to:3000/")
```

### Download Implementation
```kotlin
fun downloadJob(nasPath: String) {
    // 1. GET /api/download-job/{nasPath}
    // 2. Parse file list
    // 3. For each file:
    //    - GET /api/download-file/{filePath}
    //    - Save to /storage/emulated/0/Trimble Data/Projects/{nasPath}/
    // 4. Call JavaScript callback when done
}
```

### Upload Implementation
```kotlin
fun uploadFieldData(localPath: String) {
    // 1. Get NAS path from localPath
    // 2. List all files in local directory
    // 3. POST to /api/upload-field-data-android with multipart
    // 4. Include jobPath in form data
    // 5. Server creates Field_Data-TIMESTAMP folder
}
```

## Notes
- All paths use forward slashes (/)
- Job paths are relative to office root on NAS
- Android local paths: `/storage/emulated/0/Trimble Data/Projects/`
- Timestamps format: `Field_Data-YYMMDD-HHMM[AM/PM]`
- Existing .job files are not overwritten on download