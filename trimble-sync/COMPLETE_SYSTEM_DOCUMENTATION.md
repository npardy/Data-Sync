# Trimble Sync System - Complete Documentation

## Overview
The Trimble Sync System is a complete solution for managing Trimble job files between office PCs and field controllers (TSC5). It consists of:
1. **Server** - Node.js/Docker running on Synology NAS
2. **Web Portal** - React-based interface for job management
3. **Android App** - WebView wrapper for TSC5 controllers with native UI

## System Architecture

### Server Components
- **Platform**: Synology NAS
- **Technology**: Node.js with Express, running in Docker
- **Features**:
  - JXL file generation (Python)
  - JOB file conversion (Wine + .NET Framework)
  - File management and synchronization
  - RESTful API endpoints
  - Field data organization with timestamped folders

### Directory Structure
```
NAS:
/volume1/Pardy Surveys/Data Sync/
├── trimble-sync/          # Application code
├── office-jobs/           # Office job files
├── controller-jobs/       # Controller mirror (legacy)
└── templates/             # Job templates

Controller (TSC5):
/storage/emulated/0/Trimble Data/Projects/
└── [Same structure as office-jobs]
```

## Workflow

### 1. Creating Jobs (PC → Server)
1. **User Action**: Create new job in web portal
2. **Process**:
   - Creates folder structure on NAS
   - Generates JXL file with job metadata
   - Converts JXL to JOB format (using Wine)
   - Saves job_info.json with metadata including address
3. **Result**: Complete job package ready for field use

### 2. Downloading Jobs (Server → Controller)
1. **User Action**: Click download button (icon) on job folder or individual file in Android app
2. **Process**:
   - Android app calls `window.TrimbleSync.syncJobToTrimble(jobPath)`
   - For folders: Downloads all files preserving folder structure
   - For files: Downloads individual file to correct location
   - Skips existing .job files to prevent overwriting
3. **Result**: Job files on controller at `/storage/emulated/0/Trimble Data/Projects/`

### 3. Field Work
- Use Trimble Access with downloaded jobs
- Collect data, take photos
- Export CSV/DXF files
- All saved in local job folder

### 4. Uploading Field Data (Controller → Server)
1. **User Action**: Click "Upload" button on job in Android app
2. **Process**:
   - Collects all files from job folder
   - Uploads to `/api/upload-field-data-android`
   - Server creates structure: `Field_Data/YYMMDD-HHMM[AM/PM]/`
3. **Result**: Field data organized in Field_Data folder with timestamped subfolders

## Technical Implementation

### Docker Setup
```dockerfile
FROM node:18
# Includes:
- Python 3 (for JXL generation)
- Wine + .NET 4.7.2 (for JOB conversion)
- Node.js server
- Virtual display (Xvfb) for Wine GUI components
```

### Server Endpoints

#### Job Management
- `POST /api/create-job` - Create new job with metadata
- `GET /api/folders` - Get folder tree structure
- `GET /api/templates` - List available templates

#### Android Download
- `GET /api/download-job/{path}` - Get file list for job
- `GET /api/download-file/{path}` - Download individual file

#### Android Upload
- `POST /api/upload-field-data-android` - Upload with timestamp folders

#### File Operations
- `POST /api/upload` - General file upload
- `POST /api/delete` - Delete files/folders
- `POST /api/create-main-folder` - Create folders

### Android App

#### WebView Configuration
```java
- JavaScript enabled
- File access enabled
- JavaScript interface: "TrimbleSync"
- Custom download manager for file transfers
```

#### JavaScript Bridge Methods
```javascript
window.TrimbleSync = {
    listTrimbleJobs()      // List jobs on device
    syncJobToTrimble(path) // Download job from server
    uploadFieldData(path)  // Upload job to server
    launchTrimbleAccess()  // Open Trimble Access
    requestStorageAccess() // Android 11+ permissions
    hasStorageAccess()     // Check permissions
}
```

### JXL/JOB Generation

#### JXL Creation (Python)
- `jxl_generator.py` creates XML-based JXL files
- Links CSV/DXF files
- Includes job metadata (name, date, operator, etc.)

#### JOB Conversion (Wine + .NET)
- `TrimbleAccess.JobConverter.ConverterProcess.exe`
- Converts JXL to binary JOB format
- Requires .NET Framework 4.7.2
- Runs under Wine in Docker

## File Types

### Core Files
- `.job` - Binary Trimble job file (created by converter)
- `.jxl` - XML job exchange file (created by Python)
- `job_info.json` - Metadata (address, dates, uploads)

### Data Files
- `.csv` - Control points, layout data
- `.dxf` - CAD drawings
- `.jpg/.png` - Field photos
- `.xml/.landxml` - Design files

## Key Features

### Automatic Features
- JXL generation with linked files
- JOB conversion via Wine
- Folder structure preservation
- Field data organization: `Field_Data/YYMMDD-HHMM[AM/PM]/`
- Job metadata tracking (including address display)

### Manual Features
- Download entire job folders to controller
- Download individual files (for adding new layouts)
- Upload field data with timestamps
- Template-based job creation
- Photo organization and counting

### UI Features
- Native Android UI with Material Design
- Tab navigation between Controller and Office jobs
- Small download icons for minimal intrusion
- Address display with map pin icon
- Mobile-optimized touch targets

## Network Access
- **Internal**: http://192.168.1.41:3000
- **External**: http://pardysurveys.direct.quickconnect.to:3000
- **Android**: Uses external URL for flexibility

## Permissions (Android)
- Internet access
- Storage read/write
- All files access (Android 11+)
- Camera (for future features)
- Location (for geotagging)

## Troubleshooting

### Download Issues
1. Check network connectivity
2. Verify server is running: `/health` endpoint
3. Check Android permissions (needs All Files Access on Android 11+)
4. Review Logcat for errors
5. For single files: ensure file exists on server

### Upload Issues
1. Ensure job exists on controller
2. Check file permissions
3. Verify network access
4. Check server logs
5. Look for Field_Data folder in job directory

### JOB File Generation
- JXL files always created (Python)
- JOB requires Wine + .NET to work
- If JOB fails, JXL can be imported to Trimble Access

### UI Issues
- "Error loading application": Check JavaScript console
- Missing buttons: Ensure `isAndroidApp` is detected
- Duplicate functions: Restart server after code changes

## Deployment

### Server Deployment
```bash
cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
sudo docker-compose build --no-cache
sudo docker-compose up -d
```

### Android Deployment
1. Build in Android Studio
2. Install on TSC5
3. Grant all permissions
4. Configure network access

## Security Considerations
- No authentication (internal network use)
- File access restricted to configured directories
- Android app requires explicit permissions
- Docker container isolated from host

## Recent Updates

### Field Data Organization (v2.0)
- Changed from `Field_Data-YYMMDD-HHMM[AM/PM]` folders to `Field_Data/YYMMDD-HHMM[AM/PM]/`
- All uploads now organized under single Field_Data parent folder
- Cleaner job folder structure with better scalability

### Mobile UI Improvements (v2.0)
- Native Android Material Design interface
- Tab navigation for Controller/Office jobs
- Compact download buttons with icons only
- Mobile-optimized spacing and touch targets
- Floating refresh button for TSC5 jobs

### Individual File Downloads (v2.0)
- Download single files without full folder sync
- Perfect for adding new layout files mid-project
- Preserves folder structure on controller

### Address Display (v2.0)
- Job addresses shown with map pin icon
- Stored in job_info.json
- Visible in both office and controller views

## Future Enhancements
- User authentication
- Automatic sync scheduling
- Conflict resolution
- Direct Trimble Access integration
- Cloud backup integration
- Batch operations for multiple jobs