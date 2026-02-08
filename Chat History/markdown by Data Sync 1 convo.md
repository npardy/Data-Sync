# Data Sync System - Complete Architectural Analysis & Implementation Guide

> **IMPORTANT DISCLAIMER**: This document is a rough guide based on a single-session code audit. Everything in this document needs to be independently verified with a full audit to ensure nothing is missing. Line numbers, assumptions about behavior, and proposed solutions should all be confirmed against the actual codebase before any implementation begins. Do not treat any section as final without independent verification.

---

## Table of Contents

1. [Architecture Map](#deliverable-1-architecture-map)
2. [Conversion Utility Analysis](#deliverable-2-conversion-utility-analysis)
3. [Integration Point Identification](#deliverable-3-integration-point-identification)
4. [Gap Analysis](#deliverable-4-gap-analysis)
5. [Security Audit](#security-audit)
6. [nginx Reverse Proxy Auth](#nginx-reverse-proxy-auth-with-1-year-sessions)
7. [Android App Compatibility](#android-app-compatibility-with-auth)
8. [Volume Relocation](#volume-relocation)
9. [Recycle Bin for Deletions](#recycle-bin-for-deletions)
10. [HiveMind Integration Map](#hivemind-integration-map)
11. [Implementation Phases](#implementation-phases)
12. [What Still Needs Testing](#what-still-needs-testing)

---

## Files Audited

Every source file in the codebase was read line-by-line. This list should be independently verified to confirm no files were missed:

| File | Lines | Description |
|------|-------|-------------|
| `trimble-sync/server.js` | ~1801 | Main Express.js server, all 26 API endpoints |
| `trimble-sync/config.js` | 55 | Feature flag configuration via environment variables |
| `trimble-sync/docker-compose.yml` | 48 | Docker container and volume mount configuration |
| `trimble-sync/Dockerfile` | 70 | node:18 + Wine + Python3 + .NET 4.7.2 via winetricks + Xvfb |
| `trimble-sync/notifier.js` | 51 | JSONL notification queue to events.jsonl |
| `trimble-sync/logger.js` | 96 | Activity logging to sync-activity.log |
| `trimble-sync/uploadHandler.js` | 104 | Multer streaming/memory disk storage toggle |
| `trimble-sync/idempotencyStore.js` | 154 | MD5-based duplicate upload detection, 1-hour TTL |
| `trimble-sync/progressStore.js` | 131 | In-memory upload progress tracking |
| `trimble-sync/checksumUtil.js` | 78 | MD5 streaming checksum for file integrity |
| `trimble-sync/package.json` | 23 | Dependencies: express, multer, xml2js, archiver, cors |
| `trimble-sync/public/index.html` | 150 | HTML shell loading React via CDN + Babel + Tailwind |
| `trimble-sync/public/app.js` | ~1300 | Full React frontend (single-file component) |
| `trimble-sync/public/upload-status.html` | 385 | Standalone upload progress monitoring page |
| `trimble-sync/test_android.html` | 36 | Debug page for detecting TrimbleSync JS interface |
| `trimble-sync/trimble-converter/jxl_generator.py` | 745 | Python JXL template generator with coord system extraction |
| `trimble-sync/trimble-converter/batch_convert_jxl.py` | 95 | Batch JXL-to-JOB conversion script |
| `Android_App/.../MainActivity.java` | ~1032 | Android WebView wrapper + native upload via HttpURLConnection |
| `Android_App/.../FileDownloadManager.java` | 222 | Native HTTP file downloads (no cookies, no custom headers) |
| `Android_App/.../BuildConfig.java` | 12 | Version 1.0.1, build code 2 |
| `notifications/events.jsonl` | 45 | Real notification events from Jan-Feb 2026 |

---

## Deliverable 1: Architecture Map

### System Overview

```
Synology NAS (Docker Container: node:18 + Wine + Python3)
  trimble-sync/server.js (Express.js on port 3000)
  Volumes:
    /data/office       → NAS: /volume1/Pardy Surveys/Data Sync/office-jobs
    /data/controller   → NAS: /volume1/Pardy Surveys/Data Sync/controller-jobs
    /data/templates    → NAS: /volume1/Pardy Surveys/Data Sync/templates
    /data/notifications → NAS: /volume1/Pardy Surveys/Data Sync/notifications
```

### All 26 API Endpoints

> **Verify**: These endpoints and their line numbers should be confirmed against the actual server.js.

| # | Method | Endpoint | Line | Auth | Destructive | Path Validation | Activity Logged |
|---|--------|----------|------|------|-------------|-----------------|-----------------|
| 1 | GET | `/` | static | No | No | N/A | No |
| 2 | GET | `/api/folders/*` | ~265 | No | No | Yes (validatePath) | No |
| 3 | GET | `/api/files/*` | ~290 | No | No | Yes | No |
| 4 | GET | `/api/oauth/callback` | ~298 | No | No | No | No |
| 5 | POST | `/api/delete` | ~360 | **NO** | **YES - PERMANENT** | **NO** | **NO** |
| 6 | POST | `/api/create-job` | ~433 | No | No | Yes | Yes (notification) |
| 7 | POST | `/api/create-main-folder` | ~549 | No | No | Partial | No |
| 8 | GET | `/api/templates` | ~580 | No | No | N/A | No |
| 9 | GET | `/api/template-files/*` | ~600 | No | No | Yes | No |
| 10 | POST | `/api/store-pending-field-status` | ~656 | No | No | N/A | No |
| 11 | POST | `/api/upload` | ~690 | No | No | Yes | Yes |
| 12 | GET | `/api/search` | ~740 | No | No | N/A | No |
| 13 | POST | `/api/sync-to-controller` | ~779 | No | No | **NO** | No |
| 14 | POST | `/api/sync-from-controller` | ~804 | No | No | **NO** | No |
| 15 | POST | `/api/rename` | ~870 | No | Modifies | Yes | No |
| 16 | POST | `/api/generate-job-file` | ~987 | No | No | Yes | No |
| 17 | GET | `/api/download-job/*` | ~1200 | No | No | **NO** | No |
| 18 | GET | `/api/download-file/*` | ~1255 | No | No | Yes | No |
| 19 | POST | `/api/upload-field-data-android` | ~1285 | No | No | Yes | Yes |
| 20 | GET | `/api/upload-status` | ~1600 | No | No | N/A | No |
| 21 | GET | `/api/active-uploads` | ~1620 | No | No | N/A | No |
| 22 | GET | `/api/job-info/*` | ~1640 | No | No | Yes | No |
| 23 | GET | `/health` | ~1670 | No | No | N/A | No |
| 24 | GET | `/healthz` | ~1680 | No | No | N/A | No |
| 25 | GET | `/api/whoami` | ~1690 | No | No | N/A | No |
| 26 | GET | `/upload-status` | static | No | No | N/A | No |

### File Flow Pipeline: Field Data Upload (Primary Path)

```
TSC5 Controller (Android App)
  │
  │  POST /api/upload-field-data-android
  │  (multipart: files[] + jobPath)
  │
  ▼
server.js:~1285 ── upload-field-data-android handler
  │
  ├─ 1. Web UI calls POST /api/store-pending-field-status (server.js:~656)
  │     - Stores operator, jobType, uploadType, time tracking, notes
  │     - In-memory Map with 5-minute TTL auto-cleanup
  │
  ├─ 2. Multer receives files (disk streaming or memory buffer)
  │     - Streaming: files land in /data/office/.uploads-temp/{uploadId}/
  │     - Memory: files held in RAM buffer
  │
  ├─ 3. Idempotency check (idempotencyStore.js)
  │     - MD5 of (jobPath + sorted filenames + sizes)
  │     - 1-hour TTL, returns cached result if duplicate
  │
  ├─ 4. Create timestamped folder:
  │     /data/office/{jobPath}/Field_Data/{YYMMDD-HHMMAM}/
  │     Example: /data/office/26-000-050/26-014/26-014-260206/Field_Data/260206-0535PM/
  │
  ├─ 5. Move/write files to final destination
  │     File types received: .job, .csv, .dxf, .jpg, .jpeg, .png
  │     (Streaming mode: atomic rename from temp; Legacy: write buffer)
  │     NOTE: .jxl is NOT uploaded from field - only .job
  │
  ├─ 6. Per-file checksum computation (MD5, if UPLOAD_CHECKSUM_ENABLED)
  │
  ├─ 7. Update job_info.json metadata
  │     - Appends to fieldDataUploads[] array
  │     - Optionally updates jobType from field status
  │
  ├─ 8. Extract CSV data (server.js:~116-141)
  │     - Finds CSV file (excludes "layout" and "control" files)
  │     - Parses feature codes: FIP/FIB → evidence_found
  │     - CIP/PIP → pins_placed, PNF → evidence_not_found
  │     - FIND* → evidence_to_find, *-CKS → monument_checks
  │
  ├─ 9. Create field_status.json in upload folder
  │     - Combines pending field status + CSV extracted data
  │     - Schema version 1.0
  │     - Contains: operator, job_type, upload_type, time_spent,
  │       field_work_done, pins_found/placed, notes, csv_extracted, qbo_sync
  │
  ├─ 10. Log completion (logger.js → sync-activity.log)
  │
  └─ 11. Queue notification for HiveMind (notifier.js)
        - Appends JSONL to /data/notifications/events.jsonl
        - Event type: "field_data_uploaded"
        - Includes: job_number, job_path, folder_name, field_status summary
        - NON-BLOCKING: failures logged but don't throw
```

### File Flow: Job Creation (Office → Controller)

```
Web UI (office browser)
  │
  │  POST /api/create-job
  │
  ▼
server.js:~433
  │
  ├─ 1. Create folder: /data/office/{parentPath}/{jobNumber}-{date}/
  ├─ 2. Write job_info.json metadata
  ├─ 3. Queue notification: "layout_job_created"
  ├─ 4. Copy template files if specified:
  │     - JXL: Parse with xml2js, update jobName/TimeStamp/JobNote, save
  │     - Control CSV: Rename with date
  │     - Other files: copy as-is
  └─ 5. Return success
```

### File Flow: JXL/JOB Generation

```
Web UI
  │
  │  POST /api/generate-job-file
  │
  ▼
server.js:~987
  │
  ├─ 1. Run Python3: trimble-converter/jxl_generator.py
  │     - Extracts coordinate system from reference JXL template
  │     - Builds hardcoded Trimble Access-compatible JXL structure
  │     - Inserts: linked CSV files, DXF/LandXML map files
  │     - Inserts: reference, description, operator, job note
  │     - Output: {jobFolderName}.jxl in job directory
  │
  └─ 2. Run Wine: TrimbleAccess.JobConverter.ConverterProcess.exe
        - Command: --command=jxl-to-job
        - Input: generated .jxl file
        - Output: {jobFolderName}.job in same directory
        - Depends: .NET 4.7.2, Wine, gsconv*.dll, geodata files
        - Falls back gracefully if .job conversion fails
```

### File Types and Their Handling

| File Type | Source | Processing | Destination |
|-----------|--------|-----------|-------------|
| .job | Controller upload / Wine conversion | Stored as-is | Field_Data/{timestamp}/ |
| .jxl | Python generation (NOT from field) | Template source for coord system extraction | Job root folder |
| .csv | Controller upload | **Parsed for feature codes** (FIP/FIB/CIP/PIP/PNF/FIND/*-CKS) | Field_Data/{timestamp}/ |
| .dxf | Controller upload | Stored as-is | Field_Data/{timestamp}/ |
| .jpg/.jpeg/.png | Controller upload | Stored as-is | Field_Data/{timestamp}/ |
| job_info.json | System-generated | Updated on upload with fieldDataUploads[] | Job root folder |
| field_status.json | System-generated | Created from pending status + CSV parse | Field_Data/{timestamp}/ |

### Notification Events (3 types)

| Event | Trigger | Key Data |
|-------|---------|----------|
| `layout_job_created` | POST /api/create-job | job_number, address, job_type, folder_path |
| `field_data_uploaded` | POST /api/upload-field-data-android | job_number, field_status (operator, csv_extracted, etc.) |
| `job_deleted` | POST /api/delete (job folder) | job_number, job_name, folder_path |

---

## Deliverable 2: Conversion Utility Analysis

### CRITICAL FINDING: The .jxl is NOT uploaded from field

> **Verify**: Confirm this by reading MainActivity.java uploadFieldData() method and checking what file extensions are collected.

After tracing the Android app source code (`Android_App/app/src/main/java/.../MainActivity.java`), the upload flow is confirmed:

The `uploadFieldData()` method (line ~596) collects these files:
1. **The .job file** (line ~643) - the binary Trimble job file
2. **Exported files** (lines ~646-654) - CSV/DXF that Trimble Access exported
3. **Linked files** (lines ~657-665) - layout CSV/DXF files
4. **Photos** (lines ~668-679) - from `{jobName} Files` companion folder

**The .jxl is NEVER uploaded.** The app scans for `.job` / `.JOB` files only (line ~285).
The .jxl files in controller-jobs are the original templates from job creation, NOT field data.

This means:
- All field observations, GNSS data, stakeout records exist ONLY in the binary .job file
- The .job → .jxl reverse conversion IS required to access point data in readable XML format
- The earlier assumption that "controllers upload both .job and .jxl" was wrong

### The Converter: TrimbleAccess.JobConverter.ConverterProcess.exe

**Location**: `trimble-sync/trimble-converter/JobConversion/`

**What it is**: A .NET Framework 4.7.2 Windows executable from Trimble that converts between JobXML (.jxl) and binary Trimble job (.job) formats.

**Dependencies**:
- `TrimbleAccess.JobConverter.ConverterProcess.exe` - Main executable
- `NDesk.Options.dll` - Command-line options library
- `gsconv0400.dll`, `gsconv1810.dll`, `gsconv1820.dll`, `gsconv1900.dll` - Trimble geodetic conversion libraries
- `geodata/atlht2_0.ggf` - Geodata file (geoid grid)
- Wine (in Docker container) - Windows compatibility layer
- .NET Framework 4.7.2 (installed via winetricks in Dockerfile)
- Xvfb (virtual framebuffer for Wine's GUI needs)

**Currently used direction**: JXL → JOB (forward, for job creation)

Command-line interface:
```
wine TrimbleAccess.JobConverter.ConverterProcess.exe \
  --command=jxl-to-job \
  --inPath={input.jxl} \
  --outPath={output.job} \
  --convertersPath={directory with gsconv*.dll} \
  --geodataPath={geodata directory}
```

**Required direction for field data parsing: JOB → JXL (reverse)**:
The Trimble JobConverter typically supports `--command=job-to-jxl` as a standard feature.
**This has NOT been tested or implemented in the current codebase. Must be validated before anything else.**

### The JXL Generator: jxl_generator.py

**Location**: `trimble-sync/trimble-converter/jxl_generator.py` (745 lines)

**What it does**: Generates NEW JXL files from a hardcoded template structure for job creation. Uses string concatenation line-by-line for exact Trimble Access formatting. NOT an XML DOM builder.

**Key capabilities**:
- Extracts coordinate system data from reference JXL using `xml.etree.ElementTree`
- Adds **duplicate** coordinate system records (Trimble Access expects these after conversions)
- Strips and regenerates ID and TimeStamp attributes on all records
- Has CLI interface via argparse for server integration

**Elements it reads/writes** (from reference JXL):
- UnitsRecord, EllipsoidRecord, ProjectionRecord, DatumRecord
- DisplacementModelsRecord, KinematicTransformationsRecord, ReferenceFrameTransformationsRecord
- HorizontalAdjustmentRecord, VerticalAdjustmentRecord, CoordinateSystemRecord
- FeatureCodingRecord, CorrectionsRecord, NoteRecord
- LinkedFilesRecord, ActiveMapFilesRecord, JobPropertiesRecord, TimeZoneRecord
- Environment section (CoordinateSystem, DisplaySettings, JobSettings, etc.)

**Critical limitation**: Does NOT read or parse **FieldBook point data records** (PointRecord, GPSPosition, StakeoutRecord, etc.). Only handles job setup/configuration records.

---

## Deliverable 3: Integration Point Identification

### Where to Insert .job → .jxl Processing

The insertion point is **inside the `upload-field-data-android` handler** in `server.js`, between steps 8 and 9 (after CSV extraction, before field_status.json creation).

> **Verify**: Confirm the exact line numbers by reading server.js. The lines referenced below are approximate.

**The new pipeline within the upload handler:**

```
Files written to disk (step 5)
  │
  ├─ 8. CSV extraction (existing - server.js:~1444)
  │
  ├─ NEW 8a. Find .job file in uploaded files
  │
  ├─ NEW 8b. Convert .job → .jxl via Wine
  │     wine ConverterProcess.exe --command=job-to-jxl \
  │       --inPath={uploaded.job} --outPath={converted.jxl} ...
  │     (Save converted .jxl alongside uploaded files)
  │
  ├─ NEW 8c. Parse converted .jxl FieldBook for:
  │     - PointRecord (coordinates, classification)
  │     - GPSPosition / GPSObservation (GNSS quality)
  │     - StakeoutRecord (target vs actual, deltas)
  │     - TSObservation (total station data)
  │     → Produce structured JSON summary
  │
  ├─ 9. Build field_status.json (include parsed summary)
  │
  └─ 11. Queue HiveMind notification (include parsed summary)
```

**Why this location?**
- Files are already written to disk at this point
- CSV extraction already happens here
- The field_status.json is built immediately after
- The notification fires AFTER field_status.json is created
- This ensures the summary is complete BEFORE HiveMind is notified
- The Wine converter is already available in the Docker container

### Files That Would Need Changes

1. **`trimble-sync/server.js`** — Add JXL conversion + parsing call after CSV extraction, include parsed data in field_status.json and notification payload
2. **NEW: `trimble-sync/jxlParser.js`** — Parse JobXML FieldBook records, extract points/GNSS/stakeout, return structured JSON
3. **`trimble-sync/config.js`** — Add feature flag: `JOB_TO_JXL_CONVERSION_ENABLED`
4. **NO changes needed to**: notifier.js, Dockerfile, docker-compose.yml (no new volumes)

### Async vs Sync Processing

**Option A - Synchronous**: Convert inline, delay upload response by conversion time
**Option B - Async (recommended)**: Return upload success to controller immediately, convert in background, write summary when done, THEN fire notification

Option B is preferred because:
- The controller gets its success response fast
- The notification must wait for the summary anyway
- HiveMind doesn't care about response latency to the controller

---

## Deliverable 4: Gap Analysis

### What Already Exists
- JXL XML parsing capability (`xml2js` in package.json, used in server.js)
- JXL structure knowledge (jxl_generator.py understands full schema)
- CSV feature code parsing (server.js parseCSVForFeatureCodes)
- Notification pipeline to HiveMind (notifier.js → events.jsonl)
- Feature flag infrastructure (config.js)
- Docker container with Python3, Wine, .NET 4.7.2
- Field status data already flows to notifications

### What's Missing

#### 1. JXL Point Data Parser (Must Build)
No code currently parses the FieldBook section of a field-collected JXL for:
- **PointRecord** - Point ID, coordinates (N, E, Elevation), classification
- **GPSPosition** / **GPSObservation** - GNSS quality (PDOP, HDOP, solution type, occupation time)
- **StakeoutRecord** - Stakeout target points, actual positions, deltas
- **RoundRecord** / **TSObservation** - Total station observations
- **DeletedRecord** - Overwritten/deleted points

Build a Node.js module (`jxlParser.js`) using `xml2js` (already installed) that does lossless XML→JSON parsing preserving every element, attribute, and text node.

#### 2. JXL Schema Documentation (Partial Gap)
Need access to a real field-collected JXL file (with actual point data, not just templates) to understand the exact structure. The schema URL in existing JXL files points to: `http://www.trimble.com/schema/JobXML/6_3/JobXMLSchema-6.32.xsd`

#### 3. .job → JXL Reverse Conversion (MUST TEST FIRST)
- `--command=job-to-jxl` has NEVER been tested in Docker/Wine
- This is the #1 blocker — nothing else can proceed until this is confirmed working
- Need a real field .job file to test with

#### 4. No New Dependencies Required
- `xml2js` already installed
- Python3 already in Docker image
- No new executables or libraries needed

#### 5. Race Condition Prevention (Already Handled)
- Notification fires AFTER all processing is complete
- field_status.json is written BEFORE notification
- Proposed JXL parsing slots into the same flow
- HiveMind polls events.jsonl, appended only AFTER all processing

---

## Security Audit

> **IMPORTANT**: This security audit should be independently verified. A second full read of all source files is recommended to confirm nothing was missed.

### Vulnerabilities Found

#### 1. NO AUTHENTICATION ON ANY ENDPOINT (Critical)
- All 26 endpoints are publicly accessible to anyone who knows the URL
- The Synology DDNS domain (`pardysurveys.synology.me`) is internet-facing
- This was exploited on Feb 7, 2026 at ~6:43 AM NST when someone hit the delete endpoint and wiped all job folders in rapid succession (18 folders in under 2 minutes)

#### 2. PERMANENT DELETION — fs.rm() Bypasses Synology Recycle Bin (Critical)
- `server.js` delete endpoint (~line 360) uses `fs.rm(folderPath, { recursive: true, force: true })`
- Docker operates on raw volume mounts, completely bypassing Synology's DSM/SMB recycle bin
- Deleted data is GONE unless recovered from Synology Drive sync or other backups
- The file-level delete uses `fs.unlink()` — same problem

#### 3. NO PATH VALIDATION ON 4 ENDPOINTS (High)
These endpoints accept user-supplied paths but do NOT call `validatePath()`:
- `POST /api/delete` — can delete anything under OFFICE_ROOT
- `GET /api/download-job/*` — can read directory listings outside intended scope
- `POST /api/sync-to-controller` — can copy files to arbitrary paths
- `POST /api/sync-from-controller` — can copy files from arbitrary paths

Meanwhile, `GET /api/download-file/*` DOES have path traversal checks (~lines 1261-1265). This inconsistency suggests the others were oversight.

#### 4. XSS in OAuth Callback (Medium)
- `server.js` ~lines 298-349: `req.query` parameters are interpolated directly into HTML response
- An attacker could craft a URL with malicious query parameters that execute JavaScript in the user's browser

#### 5. innerHTML Injection in Upload Status (Low)
- `upload-status.html` line ~293: `upload.jobPath` rendered via innerHTML
- `app.js` has similar patterns with job paths
- Lower risk since data comes from the server's own API, but a crafted job path could inject HTML

#### 6. NO DELETE ACTIVITY LOGGING (Medium)
- Deletions only go to `console.log`, NOT to `sync-activity.log`
- `logger.js` has methods for upload, download, handshake events — but NO delete method
- No audit trail for who deleted what and when

### Additional Security Notes
- `isControllerRequest()` (~line 255) checks User-Agent for "Android" or "TrimbleSync" — used ONLY for logging, NOT for auth. This is correct behavior but worth noting.
- CORS allows requests with NO origin header (`if (!origin) return callback(null, true)` at ~line 183) — necessary for native HTTP calls from Android but opens surface area
- No rate limiting on any endpoint
- No CSRF protection

---

## nginx Reverse Proxy Auth with 1-Year Sessions

> **Verify**: The nginx/OpenResty approach described here needs to be tested in the actual Synology Docker environment. The Synology DSM API endpoint accessibility from within Docker must be confirmed.

### Architecture

```
Internet
  │
  ▼
Synology Built-in Reverse Proxy (TLS termination on port 443)
  │
  ▼
nginx/OpenResty Container (new, port 8080)
  │
  ├─ Has login page → validates against Synology DSM API
  ├─ Issues encrypted session cookie (1-year expiry)
  ├─ All requests must have valid cookie OR match exemption rules
  │
  ▼
trimble-sync Container (existing, port 3000)
```

### Why OpenResty (nginx + Lua)

- Standard nginx can't do custom auth logic (cookie validation, DSM API calls)
- OpenResty adds Lua scripting inside nginx — can validate sessions, call APIs, set cookies
- Reusable for other programs on the NAS (FireCast, C3, MAA, etc.)
- Lightweight — single container, minimal resources

### Session Flow

1. User hits any URL → nginx checks for `trimble_session` cookie
2. No cookie or expired → redirect to `/auth/login` page
3. User enters Synology NAS username + password
4. nginx Lua calls `http://host.docker.internal:5000/webapi/auth.cgi` to validate
5. If valid → set encrypted `trimble_session` cookie with 1-year expiry
6. All subsequent requests pass through with cookie
7. Cookie is HttpOnly, Secure, SameSite=Lax

### Docker Setup

```yaml
# Added to docker-compose.yml
nginx-auth:
  image: openresty/openresty:alpine
  ports:
    - "8080:8080"
  volumes:
    - ./nginx/nginx.conf:/usr/local/openresty/nginx/conf/nginx.conf
    - ./nginx/lua:/usr/local/openresty/nginx/lua
  depends_on:
    - trimble-sync
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

Then update Synology's built-in reverse proxy to point to port 8080 instead of 3000.

### Credential Validation via Synology DSM API

```
POST http://host.docker.internal:5000/webapi/auth.cgi
Content-Type: application/x-www-form-urlencoded

api=SYNO.API.Auth&version=3&method=login&account={username}&passwd={password}&session=TrimbleSync&format=sid
```

> **Verify**: Test that `host.docker.internal` resolves correctly from within a Docker container on Synology DSM. Some Synology Docker versions may need `extra_hosts` configuration.

---

## Android App Compatibility with Auth

> **CRITICAL**: This section describes 3 types of HTTP calls from the Android app. This must be independently verified by reading MainActivity.java and FileDownloadManager.java in full.

### The 3 Types of HTTP Calls

The Android app makes HTTP calls in THREE different ways, each with different cookie/header behavior:

#### Type 1: WebView Fetch (carries cookies automatically)
- All `fetch()` calls from `app.js` running inside the WebView
- Includes: folder browsing, job creation, template listing, field status storage, search, rename, browser-based upload, generate-job-file, sync-to-controller, sync-from-controller, **DELETE**
- **Auth handling**: WebView shares cookie jar — once logged in via the login page, all fetch calls automatically include the session cookie. NO CHANGES NEEDED.

#### Type 2: Native Upload via HttpURLConnection (NO cookies)
- `MainActivity.java` `uploadFilesToServer()` method (~line 707)
- Endpoint: `POST /api/upload-field-data-android`
- Sets custom headers:
  ```
  User-Agent: TrimbleSync/1.0.1
  X-Client-Version: 1.0.1
  ```
- **Auth handling**: Cannot carry cookies. Needs path-based exemption in nginx. Can identify by `TrimbleSync/` User-Agent header.

#### Type 3: Native Download via HttpURLConnection (NO cookies, NO custom headers)
- `FileDownloadManager.java` (~lines 54, 123-143)
- Endpoints: `GET /api/download-job/*` and `GET /api/download-file/*`
- **Sets NO custom User-Agent** — unlike uploads, downloads use Java's default User-Agent
- **Auth handling**: Cannot carry cookies AND cannot be identified by User-Agent. This is the hardest case. Options:
  - **Option A**: Token query parameter (e.g., `?token=xxx`) — WebView JS adds token to download URLs before calling native
  - **Option B**: IP subnet whitelist for known controller IP ranges
  - **Option C**: Modify Android app to add custom header (requires app update)

### nginx Path Exemptions (Without App Changes)

```nginx
# Exempt native upload — identified by TrimbleSync User-Agent
location /api/upload-field-data-android {
    if ($http_user_agent ~* "TrimbleSync/") {
        proxy_pass http://trimble-sync:3000;
    }
    # Non-TrimbleSync requests still need auth cookie
    access_by_lua_file /lua/check_session.lua;
    proxy_pass http://trimble-sync:3000;
}

# Exempt health check
location /healthz {
    proxy_pass http://trimble-sync:3000;
}

# Download endpoints — PROBLEM: no way to identify native calls
# without a token mechanism or app changes
location /api/download-job/ {
    # TODO: needs token-based auth or app modification
    access_by_lua_file /lua/check_session.lua;
    proxy_pass http://trimble-sync:3000;
}
```

### Download Auth Problem — Recommended Solution

The cleanest approach WITHOUT modifying the Android app:

1. When WebView JS calls `window.TrimbleSync.syncJobToTrimble(path)`, it first calls a server endpoint to generate a short-lived download token
2. The token is passed to the native Java code as a parameter
3. FileDownloadManager appends `?auth_token=xxx` to download URLs
4. nginx validates the token in Lua

**BUT** this requires changing the Android app's JavaScript interface. Alternatively:

- The WebView `fetch()` could pre-authorize the download by calling a server endpoint that whitelists the client IP for 60 seconds
- FileDownloadManager's native calls from that IP would then be allowed through

> **Verify**: Determine which approach is least disruptive. The JS interface bridge in MainActivity.java should be examined to see if parameters can be passed to `syncJobToTrimble()`.

---

## Volume Relocation

### Current Location
```
/volume1/Pardy Surveys/Data Sync/
  ├── trimble-sync/          (app code + Docker)
  ├── office-jobs/           (synced job data)
  ├── controller-jobs/       (controller data)
  ├── templates/             (job templates)
  ├── notifications/         (HiveMind events.jsonl)
  └── Android_App/           (Android source code)
```

### Proposed Location
```
/volume1/DataSync/
  ├── trimble-sync/
  ├── office-jobs/
  ├── controller-jobs/
  ├── templates/
  ├── notifications/
  └── Android_App/
```

### Why Relocate
- Currently sits inside the `Pardy Surveys` shared folder — if that share is breached, all company files are exposed alongside the app
- `/volume1/DataSync/` is isolated — a breach of the Data Sync app only exposes Data Sync data
- Cleaner path without spaces (avoids quoting issues in scripts)

### What Needs to Change

> **Verify**: Each of these changes should be independently confirmed. Other programs or scripts that reference these paths may exist and should be checked.

1. **`docker-compose.yml`** — Update all 5 volume mount paths:
   ```yaml
   volumes:
     - "/volume1/DataSync/trimble-sync:/app"
     - "/volume1/DataSync/office-jobs:/data/office"
     - "/volume1/DataSync/controller-jobs:/data/controller"
     - "/volume1/DataSync/templates:/data/templates"
     - "/volume1/DataSync/notifications:/data/notifications"
   ```

2. **HiveMind** — Update its volume mount or file path to read `/volume1/DataSync/notifications/events.jsonl` instead of the old path

3. **Synology Drive sync** — Joe's laptop sync target needs updating to the new folder location

4. **Synology Shared Folder** — Create a new shared folder or use a direct volume path. Consider permissions carefully.

5. **NO code changes needed** — All paths inside Docker are relative to `/data/` mount points. The app doesn't know or care about the host path.

6. **Other NAS programs to check for references to old path**:
   - FireCast
   - C3
   - MAA
   - Any cron jobs or scheduled tasks on the Synology

---

## Recycle Bin for Deletions

### The Problem
- `server.js` delete endpoint uses `fs.rm()` with `recursive: true, force: true`
- Docker operates on raw volume mounts — bypasses Synology's built-in recycle bin entirely
- Deleted data is permanently gone

### The Solution: Application-Level Recycle Bin

> **Verify**: This approach should be tested to confirm Docker has write permissions to the recycle directory and that the move operation is atomic on the NAS filesystem.

Instead of `fs.rm()`, move deleted folders/files to a `.recycle/` directory within the office-jobs volume:

```
/data/office/.recycle/
  └── {original-folder-name}_{timestamp}/
      └── (all original contents preserved)
```

### Implementation

1. **New config flag** in `config.js`: `RECYCLE_BIN_ENABLED` (default: true)

2. **New utility function** (e.g., in a new `recycleBin.js` module):
   ```
   Instead of: fs.rm(folderPath, { recursive: true, force: true })
   Do:         fs.rename(folderPath, recyclePath)  // atomic move, same filesystem
   ```

3. **Modify delete endpoint** in `server.js` (~line 360):
   - If RECYCLE_BIN_ENABLED, move to `.recycle/` instead of `fs.rm()`
   - If disabled, keep existing behavior as fallback
   - Add activity logging (logger.js needs a new `deleteAction` method)
   - Add path validation (currently missing on this endpoint)

4. **Auto-cleanup**: Optional scheduled job to purge items from `.recycle/` older than X days

5. **UI unchanged**: The delete confirmation dialog in app.js stays the same. User experience is identical — items just go to recycle instead of permanent deletion.

### File-Level Deletes Too
The delete endpoint also handles individual file deletion via `fs.unlink()`. Same treatment:
- Move file to `.recycle/` with timestamp instead of unlinking
- Preserve original path structure for potential restore

---

## HiveMind Integration Map

### Single Integration Point

HiveMind's ONLY connection to Data Sync is through one file:

```
/data/notifications/events.jsonl
  (NAS path: /volume1/Pardy Surveys/Data Sync/notifications/events.jsonl)
```

> **Verify**: Confirm how HiveMind accesses this file. Is it via a Docker volume mount? Direct filesystem access? SMB share? This affects the volume relocation plan.

### How It Works
- `notifier.js` appends one JSON line per event
- Each line has: `timestamp`, `event` (type), `data` (arbitrary payload)
- Feature-flagged via `NOTIFICATIONS_ENABLED` in docker-compose.yml (currently `true`)
- Non-blocking — if write fails, it logs error but doesn't affect the upload response
- HiveMind presumably reads/tails this file to pick up new events

### Event Types and Payloads

**`layout_job_created`**:
```json
{
  "timestamp": "...",
  "event": "layout_job_created",
  "data": {
    "job_number": "26-014",
    "address": "123 Main St",
    "job_type": "boundary",
    "folder_path": "26-000-050/26-014/26-014-260206"
  }
}
```

**`field_data_uploaded`**:
```json
{
  "timestamp": "...",
  "event": "field_data_uploaded",
  "data": {
    "job_number": "26-014",
    "job_path": "26-000-050/26-014/26-014-260206",
    "folder_name": "260206-0535PM",
    "field_status": { ... }
  }
}
```

**`job_deleted`**:
```json
{
  "timestamp": "...",
  "event": "job_deleted",
  "data": {
    "job_number": "26-014",
    "job_name": "26-014-260206",
    "folder_path": "26-000-050/26-014/26-014-260206"
  }
}
```

### Impact of Changes on HiveMind

| Change | HiveMind Impact |
|--------|----------------|
| nginx auth | **None** — HiveMind reads files, not HTTP endpoints |
| Volume relocation | **Must update its path** to events.jsonl |
| .job→.jxl conversion | **None** — parsed data gets added to existing `field_status` in notification payload. HiveMind gets MORE data, same structure |
| Recycle bin | **None** — `job_deleted` event still fires, payload unchanged |
| New notification fields | **Additive only** — existing fields unchanged, new fields added |

---

## Implementation Phases

> **IMPORTANT**: Each phase should be independently planned and verified before implementation. The order below is a suggestion based on risk and dependency analysis.

### Phase 1: nginx Auth Proxy (Security First)
- Add OpenResty container to docker-compose.yml
- Build login page and Lua session validation
- Configure path exemptions for Android native calls
- Update Synology reverse proxy to point to nginx
- Test: PC browser login, WebView login, native upload, native download

### Phase 2: Recycle Bin + Delete Security
- Add `recycleBin.js` module
- Modify delete endpoint: move to `.recycle/` instead of `fs.rm()`
- Add path validation to delete endpoint
- Add delete logging to `logger.js`
- Add feature flag `RECYCLE_BIN_ENABLED`
- Test: delete via UI, verify files in `.recycle/`, verify notification still fires

### Phase 3: Volume Relocation
- Create `/volume1/DataSync/` directory structure
- Copy all data from old location
- Update docker-compose.yml volume mounts
- Update HiveMind's path to events.jsonl
- Update Joe's Synology Drive sync target
- Test: full upload/download cycle, HiveMind receives notifications
- Keep old location as read-only backup until confirmed

### Phase 4: .job → .jxl Conversion
- **FIRST**: Test `--command=job-to-jxl` with a real field .job file in Docker
- If it works: build `jxlParser.js` module
- Integrate async conversion into upload handler
- Add feature flag `JOB_TO_JXL_CONVERSION_ENABLED`
- Include parsed data in field_status.json and notification payload
- Test: upload from controller, verify .jxl created, verify JSON summary in notification

---

## What Still Needs Testing

> **None of these have been verified. Each must be tested in the actual environment.**

| Item | How to Test | Risk if it Fails |
|------|-------------|------------------|
| `--command=job-to-jxl` reverse conversion in Wine | Run in Docker with a real field .job file | Entire Phase 4 blocked |
| Synology DSM API from Docker (`host.docker.internal:5000`) | `curl` from inside the Docker container | nginx auth can't validate credentials |
| FileDownloadManager auth exemption | Test download from controller after nginx is deployed | Controllers can't download jobs |
| Volume relocation — HiveMind path | Relocate and verify HiveMind still reads events | HiveMind stops receiving notifications |
| `.recycle/` directory permissions in Docker | Create `.recycle/` and test `fs.rename()` across same filesystem | Recycle bin moves fail, fall back to delete |
| Real field .jxl FieldBook structure | Convert a field .job and examine the XML | Parser design depends on actual element names |

---

## Summary of Required Work

| Item | Effort | Risk | Phase |
|------|--------|------|-------|
| nginx/OpenResty auth container | Medium | Must test DSM API accessibility | 1 |
| Login page + Lua session logic | Medium | None if DSM API works | 1 |
| Android download auth exemption | Medium | Hardest auth problem | 1 |
| Recycle bin module | Small | Low — simple fs.rename | 2 |
| Delete endpoint hardening | Small | Low — additive changes | 2 |
| Volume relocation | Small | Must coordinate with HiveMind + Synology Drive | 3 |
| Test .job→.jxl reverse conversion | **FIRST PRIORITY** | Blocker for Phase 4 | 4 |
| Build JXL FieldBook parser | Medium | Needs real converted .jxl to confirm structure | 4 |
| Integrate conversion into upload handler | Medium | Async adds complexity | 4 |
| Feature flags for all new features | Trivial | None | All |

---

*This document was generated from a code audit performed on Feb 8, 2026. All line numbers are approximate and may drift as the codebase changes. Everything in this document is a rough guide and must be independently verified with a full audit to ensure nothing is missing, no assumptions are incorrect, and no integration points have been overlooked.*
