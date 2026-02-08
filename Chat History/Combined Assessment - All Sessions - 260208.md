# Data Sync System — Combined Assessment From All Chat Sessions
## For Use as a Prompt to a New Claude Code Instance

> **Date**: February 8, 2026
> **Source**: 3 separate Claude Code chat sessions + 1 markdown plan document, all from Feb 7-8, 2026
> **Purpose**: Give a new Claude Code instance absolutely everything it needs to audit the entire codebase, produce a bulletproof implementation plan, and ensure nothing is missed before implementation.
> **CRITICAL**: This document is compiled from multiple sessions. The new instance MUST independently verify every claim by reading all code files itself. Do not trust line numbers, assumptions, or conclusions without confirming them against the actual source code.

---

## TABLE OF CONTENTS

1. [What The User Wants](#1-what-the-user-wants)
2. [System Architecture](#2-system-architecture)
3. [Every Source File In The Codebase](#3-every-source-file-in-the-codebase)
4. [All 26 API Endpoints](#4-all-26-api-endpoints)
5. [File Flow Pipelines](#5-file-flow-pipelines)
6. [Android App — The 5 Native HTTP Calls](#6-android-app--the-5-native-http-calls)
7. [Security Vulnerabilities Found (28+ total)](#7-security-vulnerabilities-found-28-total)
8. [The Mass Deletion Incident (Feb 7, 2026)](#8-the-mass-deletion-incident-feb-7-2026)
9. [Authentication via nginx/Authelia](#9-authentication-via-nginxauthelia)
10. [Android WebView Cookie Persistence](#10-android-webview-cookie-persistence)
11. [Recycle Bin for Delete Operations](#11-recycle-bin-for-delete-operations)
12. [Volume Relocation](#12-volume-relocation)
13. [.job to .jxl Conversion](#13-job-to-jxl-conversion)
14. [JXL Parsing to JSON for HiveMind](#14-jxl-parsing-to-json-for-hivemind)
15. [HiveMind Integration Map](#15-hivemind-integration-map)
16. [Implementation Phases](#16-implementation-phases)
17. [What Still Needs Testing](#17-what-still-needs-testing)
18. [Corrections Between Sessions](#18-corrections-between-sessions)
19. [User Constraints and Non-Negotiables](#19-user-constraints-and-non-negotiables)
20. [Instructions for the New Instance](#20-instructions-for-the-new-instance)

---

## 1. WHAT THE USER WANTS

Nick Pardy, owner of Pardy Surveys (land surveying company, Newfoundland, Canada), wants these features implemented on his Data Sync system. All changes must be purely additive, feature-flagged, and must not break any existing functionality. The Android app APK must NOT be rebuilt.

### Feature List

1. **Authentication via nginx reverse proxy (Authelia)** — Users must log in with credentials that mirror their Synology NAS accounts. Must work on both PC browsers and Android controllers. Must support 1-year login sessions ("login once per year"). Must be reusable for future Docker containers on the NAS.

2. **Recycle bin for all delete operations** — When files/folders are deleted via the API, they must be MOVED to `/data/office/.recycle/` instead of permanently deleted. Must record who deleted, when, and what. Must support restore and auto-cleanup of items older than 30 days.

3. **Delete logging** — All delete operations must be logged to `sync-activity.log`. Currently deletions only go to `console.log`.

4. **Volume relocation** — Copy the entire Data Sync folder contents to `/volume1/DataSync/`. Rename `office-jobs` to `Data Sync` (the folder, not the volume). Keep the existing Docker container running with ZERO changes until the new one is confirmed working. The new Docker container should be called "Data Sync". Consider impact on HiveMind, Synology Drive sync, and other NAS programs.

5. **.job to .jxl conversion** — Convert field-uploaded `.job` binary files to readable `.jxl` (JobXML) format server-side using the existing Wine/Trimble converter in Docker. Must happen BEFORE the HiveMind notification fires. Must NOT use controller computing resources.

6. **JXL parsing to JSON** — Parse the converted `.jxl` with `xml2js` (already installed) to produce a structured JSON summary for HiveMind consumption, enabling rich conversations about field data (points, GNSS quality, stakeout records, evidence classification).

7. **Feature flags** — Every new capability must have an environment-variable-based flag (`AUTH_ENABLED`, `RECYCLE_BIN_ENABLED`, `JOB_TO_JXL_CONVERSION_ENABLED`). Existing functionality must work identically when flags are false.

8. **Full security audit** — Every endpoint, every middleware, every path operation checked for: path traversal, SSRF, XSS, information disclosure, missing input validation, command injection, CSRF.

9. **Comprehensive request logging / visitor forensics** — Every single request that hits the URL must be logged with absolutely everything that can possibly be captured about the requester. This has not been audited yet — the new instance must research and determine every piece of information that can technically be extracted. The goal is: if someone hits this server, we know absolutely everything about them that is technically possible to know. See Section 21 for full details.

---

## 2. SYSTEM ARCHITECTURE

### Overview
- **Platform**: Synology NAS running Docker
- **Container**: node:18 + Wine + Python3 + .NET Framework 4.7.2 (via winetricks) + Xvfb
- **Server**: Express.js on port 3000 (`server.js`, ~1801 lines)
- **Frontend**: Single-file React app (`public/app.js`, ~1300 lines) loaded via CDN (React, Babel, Tailwind)
- **Android App**: WebView wrapper (`MainActivity.java`) + native `HttpURLConnection` for uploads/downloads
- **Timezone**: America/St_Johns (UTC-3:30)
- **External domain**: `https://pardysurveys.synology.me/` (Synology DDNS + built-in reverse proxy doing TLS termination)

### Docker Volume Mounts (from docker-compose.yml)
```yaml
volumes:
  - "/volume1/Pardy Surveys/Data Sync/trimble-sync:/app"
  - "/volume1/Pardy Surveys/Data Sync/office-jobs:/data/office"
  - "/volume1/Pardy Surveys/Data Sync/controller-jobs:/data/controller"
  - "/volume1/Pardy Surveys/Data Sync/templates:/data/templates"
  - "/volume1/Pardy Surveys/Data Sync/notifications:/data/notifications"
ports:
  - "3000:3000"
environment:
  - TZ=America/St_Johns
  - NOTIFICATIONS_ENABLED=true
  - UPLOAD_STREAMING_ENABLED=true
```

### Traffic Flow (Current)
```
Internet → Synology Reverse Proxy (port 443 HTTPS, TLS termination)
         → Docker container (port 3000 HTTP, server.js)
         → Volume mounts to NAS filesystem
```

---

## 3. EVERY SOURCE FILE IN THE CODEBASE

> **VERIFY**: The new instance must independently confirm this file list and read every file.

### Server-side (trimble-sync/)
| File | Lines | Description |
|------|-------|-------------|
| `server.js` | ~1801 | THE main server file. All 26 API endpoints. All file processing logic. |
| `config.js` | 55 | Feature flags via environment variables |
| `docker-compose.yml` | 48 | Docker service config, volume mounts, environment variables |
| `Dockerfile` | 70 | node:18 base + Wine + Python3 + .NET 4.7.2 + Xvfb |
| `notifier.js` | 51 | JSONL notification queue — appends to events.jsonl |
| `logger.js` | 96 | Activity logging to sync-activity.log. Has upload/download/handshake methods but NO delete method. |
| `uploadHandler.js` | 104 | Multer disk/memory storage toggle, temp directory management |
| `idempotencyStore.js` | 154 | MD5-based duplicate upload detection, 1-hour TTL |
| `progressStore.js` | 131 | In-memory upload progress tracking, 1-hour TTL |
| `checksumUtil.js` | 78 | MD5 streaming checksum for file integrity |
| `package.json` | 23 | Dependencies: express, multer, xml2js, archiver, cors. NO session management library. |
| `public/app.js` | ~1300 | Full React frontend (single file). All fetch() calls, isAndroidApp detection, delete handler. |
| `public/index.html` | 150 | HTML shell loading React via CDN + Babel + Tailwind |
| `public/upload-status.html` | 385 | Standalone upload monitoring page. innerHTML XSS risk at line ~293. |
| `test_android.html` | 36 | Debug page for detecting TrimbleSync JS interface |

### Converter (trimble-sync/trimble-converter/)
| File | Lines | Description |
|------|-------|-------------|
| `jxl_generator.py` | 745 | Python JXL template generator. String concatenation, NOT XML DOM. Extracts coord system from reference JXL. Does NOT parse FieldBook point data. |
| `batch_convert_jxl.py` | 95 | Batch converter. Only uses `--command=jxl-to-job` (line 30). |
| `JobConversion/TrimbleAccess.JobConverter.ConverterProcess.exe` | N/A | .NET 4.7.2 Windows executable. Converts between .jxl and .job formats via Wine. |
| `JobConversion/NDesk.Options.dll` | N/A | Command-line options library for the converter |
| `JobConversion/gsconv*.dll` | N/A | Trimble geodetic conversion libraries (4 DLLs) |
| `geodata/atlht2_0.ggf` | N/A | Geoid grid data file |

### Android App (Android_App/)
| File | Lines | Description |
|------|-------|-------------|
| `MainActivity.java` | ~1032 | WebView wrapper. PORTAL_URL = `https://pardysurveys.synology.me/`. Contains `uploadFilesToServer()` with native HttpURLConnection. |
| `FileDownloadManager.java` | 222 | **CRITICAL**: Session 1 MISSED this file. Native HTTP downloads via HttpURLConnection. NO cookies. NO custom User-Agent. |
| `BuildConfig.java` | 12 | Version 1.0.1, build code 2 |
| `AndroidManifest.xml` | 41 | `android:allowBackup="true"`, `android:usesCleartextTraffic="false"` |

### Data Files
| File | Description |
|------|-------------|
| `notifications/events.jsonl` | 45 lines. Real notification events from Jan-Feb 2026. Contains the deletion events from the Feb 7 breach. |

---

## 4. ALL 26 API ENDPOINTS

> **VERIFY**: Line numbers are approximate. Confirm against actual server.js.

| # | Method | Endpoint | ~Line | Auth | Destructive | Path Validation | Activity Logged |
|---|--------|----------|-------|------|-------------|-----------------|-----------------|
| 1 | GET | `/` (static) | N/A | No | No | N/A | No |
| 2 | GET | `/api/folders` | ~265 | No | No | Yes | No |
| 3 | GET | `/oauth/callback` | ~298 | No | No | No (XSS vuln) | No |
| 4 | POST | `/api/delete` | ~360 | **NO** | **YES - PERMANENT** | **NO** | **NO** |
| 5 | POST | `/api/create-main-folder` | ~549 | No | No | **NO** | No |
| 6 | POST | `/api/create-job` | ~433 | No | No | **NO** (Session 2 found) | Yes |
| 7 | GET | `/api/templates` | ~580 | No | No | N/A | No |
| 8 | POST | `/api/store-pending-field-status` | ~656 | No | No | N/A | No |
| 9 | POST | `/api/upload` | ~690 | No | No | Yes | Yes |
| 10 | POST | `/api/upload-field-data` | ~688 | No | No | Yes | Yes |
| 11 | POST | `/api/sync-to-controller` | ~779 | No | No | **NO** | No |
| 12 | POST | `/api/sync-from-controller` | ~804 | No | No | **NO** | No |
| 13 | POST | `/api/generate-job-file` | ~987 | No | No | **NO** (flag injection risk) | No |
| 14 | GET | `/api/test-jxl` | ~1154 | No | No | N/A (leaks env.PATH) | No |
| 15 | GET | `/api/download-job/*` | ~1200 | No | No | **NO** | No |
| 16 | GET | `/api/download-file/*` | ~1255 | No | No | Yes (off-by-one) | No |
| 17 | POST | `/api/upload-field-data-android` | ~1285 | No | No | Yes | Yes |
| 18 | GET | `/api/download-zip/*` | ~1597 | No | No | **NO** | No |
| 19 | POST | `/api/log` | N/A | No | No | N/A | Yes |
| 20 | GET | `/health` | N/A | No | No | N/A | No |
| 21 | GET | `/healthz` | N/A | No | No | N/A | No |
| 22 | GET | `/api/whoami` | N/A | No | No | N/A | No |
| 23 | GET | `/api/upload-status/:id` | N/A | No | No | N/A | No |
| 24 | GET | `/api/upload-status` | N/A | No | No | N/A | No |
| 25 | POST | `/api/rename` | ~870 | No | Modifies | Yes | No |
| 26 | GET | `/api/job-info/*` | ~1640 | No | No | Yes | No |

**Summary**: Zero authentication on every single endpoint. 8+ endpoints missing path validation. Delete endpoint has no logging.

---

## 5. FILE FLOW PIPELINES

### Field Data Upload (Primary Path)
```
TSC5 Controller (Android App)
  │
  │  POST /api/upload-field-data-android
  │  (multipart: files[] + jobPath)
  │
  ▼
server.js:~1285
  │
  ├─ 1. Pending field status retrieved (stored earlier via WebView fetch)
  ├─ 2. Multer receives files (streaming disk or memory buffer)
  ├─ 3. Idempotency check (MD5 of jobPath + filenames + sizes, 1hr TTL)
  ├─ 4. Create timestamped folder: /data/office/{jobPath}/Field_Data/{YYMMDD-HHMMAM}/
  ├─ 5. Move/write files to final destination
  │     Files received: .job, .csv, .dxf, .jpg, .jpeg, .png
  │     NOTE: .jxl is NEVER uploaded from field — only .job
  ├─ 6. Per-file checksum (MD5, if UPLOAD_CHECKSUM_ENABLED)
  ├─ 7. Update job_info.json metadata
  ├─ 8. Extract CSV data — parse feature codes:
  │     FIP/FIB → evidence_found, CIP/PIP → pins_placed,
  │     PNF → evidence_not_found, FIND* → evidence_to_find, *-CKS → monument_checks
  ├─ 9. Create field_status.json (operator, job_type, upload_type, time_spent, csv data)
  ├─ 10. Log to sync-activity.log
  └─ 11. Queue notification → events.jsonl (field_data_uploaded)
         NON-BLOCKING: failures logged but don't throw
```

### Job Creation (Office → Controller)
```
Web UI → POST /api/create-job → server.js:~433
  ├─ Create folder /data/office/{parentPath}/{jobNumber}-{date}/
  ├─ Write job_info.json
  ├─ Queue notification: "layout_job_created"
  └─ Copy template files (JXL parsed with xml2js, CSV renamed, others copied)
```

### JXL/JOB Generation
```
Web UI → POST /api/generate-job-file → server.js:~987
  ├─ Run Python3: jxl_generator.py (builds JXL from template)
  └─ Run Wine: ConverterProcess.exe --command=jxl-to-job
```

---

## 6. ANDROID APP — THE 5 NATIVE HTTP CALLS

> **CRITICAL**: The Android app makes HTTP calls in TWO completely separate ways: WebView (carries cookies) and native HttpURLConnection (does NOT carry cookies). Session 1 missed FileDownloadManager.java entirely. Session 2 caught this.

### WebView (carries cookies automatically)
- All `fetch()` calls from `app.js` running inside the WebView
- Includes: folder browsing, job creation, template listing, field status storage, DELETE, sync operations, browser-based upload, generate-job-file
- **Auth handling**: Once logged in via login page, all fetch calls include the session cookie. No changes needed.

### Native HttpURLConnection (NO cookies, NO cookie sharing with WebView)

| # | File | Line | Method | URL | Custom Headers | Auth Bypass Strategy |
|---|------|------|--------|-----|----------------|---------------------|
| 1 | `MainActivity.java` | ~570 | GET | `PORTAL_URL + "healthz"` | None | Path bypass (non-sensitive) |
| 2 | `MainActivity.java` | ~721 | POST | `PORTAL_URL + "api/upload-field-data-android"` | `User-Agent: TrimbleSync/<ver>`, `X-Client-Version: <ver>` | User-Agent check + path bypass |
| 3 | `FileDownloadManager.java` | ~50-54 | GET | `baseUrl + "/api/download-job/" + jobPath` | **NONE** — no custom UA, no cookies | Path bypass (read-only, requires knowing paths) |
| 4 | `FileDownloadManager.java` | ~98 | GET | `baseUrl + "/api/download-file/" + path` | **NONE** | Path bypass (same) |
| 5 | `FileDownloadManager.java` | ~158 | GET | `baseUrl + "/api/download-file/" + path` | **NONE** | Path bypass (same) |

**Key finding**: FileDownloadManager has NO identifying headers at all — no custom User-Agent, no cookies, nothing. This is the hardest auth problem. The recommended approach is path-based bypass in nginx since these are read-only endpoints.

### Cookie Sharing — Definitive Answer
- Android WebView has its own `android.webkit.CookieManager` (singleton, persists to disk SQLite)
- Native `HttpURLConnection` uses `java.net.CookieHandler.getDefault()` which is **null** by default on Android
- There is ZERO cookie-related code anywhere in the Java source (confirmed by grep for Cookie, CookieManager, CookieHandler, setRequestProperty.*Cookie)
- These two HTTP stacks do NOT share cookies. Period.

---

## 7. SECURITY VULNERABILITIES FOUND (28+ TOTAL)

### Combined from all 3 sessions. Session 1 found 16. Session 2 found 12 more. Session 3 confirmed all.

#### CRITICAL
1. **No authentication on ANY endpoint** — All 26 endpoints publicly accessible. Exploited Feb 7, 2026.
2. **Permanent deletion via fs.rm()** — `server.js` delete endpoint (~line 360) uses `fs.rm(folderPath, { recursive: true, force: true })`. Docker operates on raw volume mounts, bypassing Synology recycle bin entirely.
3. **No path validation on delete endpoint** — `path.join(CONFIG.OFFICE_ROOT, folder)` with no `validatePath()` call. Attacker can send `{"folder":"../../controller-jobs"}`.
4. **Individual file deletion path traversal** — `fs.unlink()` at ~line 388 also lacks `validatePath()`.
5. **Path traversal on /api/create-job** — `path.join(CONFIG.OFFICE_ROOT, parentPath, jobFolderName)` with no validation. (Session 2 found)
6. **Path traversal on /api/generate-job-file** — Write files to arbitrary locations. (Session 2 found)

#### HIGH
7. **Command-line flag injection via /api/generate-job-file** — User input (jobName, referenceNumber, description, operator, address, linkedFiles) passed as CLI args to Python spawn. Flag injection risk. (Session 2 found)
8. **Path traversal on /api/sync-to-controller** — Both source and dest paths unvalidated.
9. **Path traversal on /api/sync-from-controller** — Both paths unvalidated.
10. **Path traversal on /api/download-job/*** — `req.params[0]` used directly, no `validatePath()`.
11. **Path traversal on /api/download-zip/*** — Same pattern.
12. **Path traversal on /api/create-main-folder** — `path.join(root, parentPath, folderName)` with no validation.
13. **Template path traversal** — `path.join(CONFIG.TEMPLATES_DIR, template)` from `req.body` with no validation. (Session 2 found)

#### MEDIUM
14. **XSS in OAuth callback** — `server.js` ~line 298-349: `${error}` and `${req.query.error_description}` interpolated directly into HTML without escaping.
15. **No CSRF protection on any state-changing endpoint** — Relevant when auth is added. (Session 2 found)
16. **pendingFieldStatus unbounded memory (DoS vector)** — Map has 5-min TTL per entry but no cap on total entries. (Session 2 found)
17. **Information disclosure in /api/test-jxl** — Exposes `process.env.PATH` and internal filesystem paths.
18. **CORS allows null origin** — Line ~155: `if (!origin) return callback(null, true)` — any tool with no Origin header bypasses CORS.

#### LOW
19. **download-file path check off-by-one** — `resolvedRoot` doesn't end with `path.sep`. Path like `/data/officejobs/secret` passes `startsWith('/data/office')`. (Session 2 found)
20. **Internal path leaks in error responses** — Multiple endpoints return `error.message` with full filesystem paths. (Session 2 found)
21. **buildFolderTree no depth limit** — Recursive with no cap. DoS via nested folders. (Session 2 found)
22. **Host header reflection** — `/api/download-job/*` reflects `req.get('host')` in response. (Session 2 found)
23. **Content-Disposition header injection** — `/api/download-zip/*` filename from unsanitized input. (Session 2 found)
24. **innerHTML XSS in upload-status.html** — `upload.jobPath` rendered via innerHTML (~line 293).
25. **No rate limiting on any endpoint**.
26. **No delete activity logging** — Deletions only go to `console.log`, not `sync-activity.log`.
27. **WebView debug enabled in production** — `WebView.setWebContentsDebuggingEnabled(true)` in MainActivity.java.
28. **Overly permissive WebView settings** — `setAllowFileAccessFromFileURLs(true)`, `setAllowUniversalAccessFromFileURLs(true)`.

---

## 8. THE MASS DELETION INCIDENT (Feb 7, 2026)

### Timeline
- **6:43 AM NST (10:13 UTC)**: 18 parent "range" folders deleted from office-jobs in rapid succession (~2 seconds apart) via `POST /api/delete`. Folders: 26-000-050, 25-200-250, 25-150-200, 25-100-150, 25-050-100, 25-000-050, 24-200-300, 24-100-200, 24-000-100, 23-000-400, 22-000-400, 21-000-22-000
- **Cause**: Unauthorized access to the unauthenticated delete endpoint
- **Recovery**: Joe had Synology Drive syncing office-jobs to his laptop. His copy was synced back. 2,225 files restored.
- **56 files NOT restored**: Old test data and empty placeholder files from months earlier (already in recycle bin from previous cleanups). Not from this incident.
- **Why Synology Recycle Bin didn't catch it**: Docker's `fs.rm()` operates on raw volume mounts, completely bypassing Synology's DSM/SMB recycle bin layer. The recycle bin only catches deletions via File Station, SMB, or Synology Drive.

### User's reaction
The user described it as "unexpected" and said "seems someone broke in to do it." This incident is the primary motivation for implementing authentication.

---

## 9. AUTHENTICATION VIA NGINX/AUTHELIA

### Architecture (Designed across Sessions 1, 2, and 3)
```
Internet
  │
  ▼
Synology Reverse Proxy (port 443 HTTPS, TLS termination)
  │
  ▼
nginx container (port 8080, auth checking)
  │
  ├─ Authelia container (port 9091, login page + session management)
  │
  ▼
trimble-sync container (port 3000, Express.js — UNCHANGED)
```

### Why Authelia + nginx (not app-level auth)
- **Reusable** — Same auth for HiveMind, Email Automation, future Docker apps. One login covers everything.
- **Language-agnostic** — Auth check happens before requests reach the service.
- **Zero code changes to server.js** — No new dependencies, no session management code.
- **The 1-year cookie** — Configurable at the Authelia level.

### Session Configuration (login once per year)
```yaml
session:
  expiration: 31536000       # 1 year
  inactivity: 31536000       # 1 year inactivity timeout
  remember_me_duration: 31536000  # 1 year remember-me
  domain: pardysurveys.synology.me
```

### Path-Based Bypass Rules for Android Native HTTP
```nginx
# Health checks — no auth
location = /healthz { proxy_pass http://trimble-sync:3000; }
location = /health  { proxy_pass http://trimble-sync:3000; }

# Android upload — restricted by User-Agent
location = /api/upload-field-data-android {
    if ($http_user_agent !~* "TrimbleSync/") { return 403; }
    proxy_pass http://trimble-sync:3000;
}

# Android downloads — path bypass (no identifying headers available)
location ~ ^/api/download-job/  { proxy_pass http://trimble-sync:3000; }
location ~ ^/api/download-file/ { proxy_pass http://trimble-sync:3000; }

# Everything else — requires Authelia login
location / {
    auth_request /api/authelia;
    error_page 401 =302 https://pardysurveys.synology.me/.auth/?rd=...;
    proxy_pass http://trimble-sync:3000;
}
```

### User Database (local file, not LDAP)
Authelia uses a local `users_database.yml` with bcrypt/argon2 hashed passwords. Users: allan, joe, nick (matching NAS accounts).

### Docker Changes Required
1. **New**: `auth-proxy/` directory with `docker-compose.yml`, `nginx/nginx.conf`, `authelia/configuration.yml`, `authelia/users_database.yml`
2. **Modified**: `trimble-sync/docker-compose.yml` — change `ports: "3000:3000"` to `expose: "3000"` + add shared network `pardy-auth-net`
3. **New**: Docker network `pardy-auth-net` created with `docker network create pardy-auth-net`
4. **Modified**: Synology reverse proxy target from port 3000 → 8080 (or nginx takes over port 443 directly)

### What This Protects
- 21 out of ~26 endpoints fully protected behind Authelia login
- Health checks: bypass (non-sensitive)
- Android bypass paths: read-only data, requires knowing exact paths, cannot enumerate
- The delete endpoint that was exploited: **FULLY PROTECTED**

---

## 10. ANDROID WEBVIEW COOKIE PERSISTENCE

### Confirmed by reading MainActivity.java, FileDownloadManager.java, AndroidManifest.xml, and build.gradle:

- `settings.setDomStorageEnabled(true)` (line ~118) — localStorage persists across app restarts
- **No** `onDestroy`, `onStop`, or `onPause` overrides — app never clears cookies on lifecycle events
- **No** calls to `CookieManager.removeAllCookies()`, `clearCache()`, `clearHistory()`, `clearFormData()` anywhere
- `android:allowBackup="true"` (AndroidManifest.xml) — cookies backed up by Android auto-backup
- `targetSdk 36`, `minSdk 23` — WebView uses persistent cookies by default (SQLite on disk)

### Cookie survives:
- App closed and reopened: **Yes**
- App force-stopped: **Yes**
- Device rebooted: **Yes**
- App updated (same package name): **Yes**

### Cookie does NOT survive:
- User clearing app data in Android Settings
- App uninstalled and reinstalled (unless Google backup restores it)

### Conclusion: Login-once-per-year is fully feasible without any Android app changes.

---

## 11. RECYCLE BIN FOR DELETE OPERATIONS

### Current Problem
- `server.js` delete endpoint uses `fs.rm(folderPath, { recursive: true, force: true })` — permanent, irreversible
- Docker's `fs.rm()` bypasses Synology recycle bin (operates on raw volume mounts)
- No logging to activity log (only `console.log`)
- No path validation on the delete endpoint

### Solution: Application-Level Recycle Bin
```
Instead of: fs.rm(folderPath, { recursive: true, force: true })
Do:         fs.rename(folderPath, /data/office/.recycle/{timestamp}_{folderName}/)
```

### Implementation Details
1. **New module**: `recycleBin.js` — handles move-to-recycle, metadata recording, restore, auto-cleanup
2. **Modified**: `server.js` delete endpoint — replace `fs.rm()` with recycle bin move when `RECYCLE_BIN_ENABLED=true`
3. **New**: `logger.js` needs a `deleteAction` method (currently has upload/download/handshake but NO delete)
4. **Add**: `validatePath()` to the delete endpoint (currently missing)
5. **Filter**: `.recycle/` directory must be excluded from `buildFolderTree()` so it doesn't appear in the UI
6. **Feature flag**: `RECYCLE_BIN_ENABLED` in `config.js` and `docker-compose.yml`
7. **Auto-cleanup**: Optional scheduled job to purge items from `.recycle/` older than 30 days
8. **Same filesystem**: `.recycle/` must be on the same Docker volume mount as office-jobs so `fs.rename()` is atomic

### Individual File Deletes Too
The delete endpoint also handles individual file deletion via `fs.unlink()` (~line 388). Same treatment — move to `.recycle/` with timestamp.

---

## 12. VOLUME RELOCATION

### CRITICAL: Migration Strategy — Copy First, Keep Old Running
The existing Docker container MUST remain running with ZERO changes until the new one is confirmed fully functional. This is non-negotiable.

**Step 1**: Copy the entire `Data Sync` folder contents to the new location
**Step 2**: Rename `office-jobs` → `Data Sync` in the new location (the data folder, not the volume)
**Step 3**: Create a NEW Docker container called "Data Sync" pointing to the new location
**Step 4**: Test absolutely everything on the new container
**Step 5**: Only after confirmed working, switch over and decommission the old container

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
**Risk**: Sits inside the `Pardy Surveys` shared folder. A breach could expose all company files.

### Proposed Location
```
/volume1/DataSync/
  ├── trimble-sync/
  ├── Data Sync/             (RENAMED from office-jobs)
  ├── controller-jobs/
  ├── templates/
  ├── notifications/
  └── nginx/                 (NEW: auth proxy config)
```

### The office-jobs → Data Sync Rename
The `office-jobs` folder is being renamed to `Data Sync`. This affects:
- **docker-compose.yml**: Volume mount source path changes from `office-jobs` to `Data Sync`
- **Inside the container**: The mount point `/data/office` stays the same (only the host path changes), BUT this must be verified — audit every reference to `/data/office` in server.js and all modules
- **HiveMind**: If it accesses the office-jobs folder directly via NAS path, it needs updating
- **Synology Drive**: Joe's sync target references this folder name
- **SMB shares**: `\\PS-NAS\DataSync\Data Sync\` instead of `\\PS-NAS\Pardy Surveys\Data Sync\office-jobs\`

### What Needs to Change
1. **docker-compose.yml**: Update all 5 volume mount source paths AND change `office-jobs` to `Data Sync` in the mount
2. **Synology DSM**: Create new shared folder "DataSync" with appropriate permissions
3. **HiveMind**: Update its path to `events.jsonl` AND any references to office-jobs folder (depends on how it accesses the file — Docker mount vs SMB vs direct filesystem)
4. **Synology Drive**: Joe's laptop sync target needs updating
5. **Windows SMB path**: `\\PS-NAS\DataSync\` instead of `\\PS-NAS\Pardy Surveys\Data Sync\`
6. **Inside Docker**: All paths are relative to `/data/` mount points, so server.js code should NOT need changes — but this MUST be audited and verified, not assumed

### Programs to check for references to old path
- HiveMind (CRITICAL — will need its own handoff document, see Section 20)
- Synology Drive sync
- Any cron jobs or scheduled tasks on the Synology
- FireCast, C3, MAA (other NAS programs)

### Handoff Document for HiveMind
After all Data Sync changes are complete, a **handoff document** must be produced. For every single change, it must show: what changed, what it's doing, why it's doing it, the old way, and the new way. Every path change, every renamed folder, every moved file, every config change, every new endpoint, every new module — all documented with before/after so there are zero surprises for HiveMind. The HiveMind instance must be able to read this document and know exactly what to update without guessing. See Section 20 item 9 for full requirements.

---

## 13. .JOB TO .JXL CONVERSION

### CRITICAL FINDING: The .jxl is NOT uploaded from field

Session 1 initially assumed "controllers upload BOTH .job and .jxl files together." This was **WRONG**. The user (Nick) challenged this assumption. Investigation proved:

- `MainActivity.java` `uploadFieldData()` method (~line 596) collects: `.job` file, exported CSV/DXF, linked layout files, photos
- The app scans for `.job` / `.JOB` files only (line ~285) — **never** `.jxl`
- The `.jxl` files in controller-jobs are original templates from job creation, NOT field data
- File sizes confirm: controller JXL (39,564 bytes) matches template JXL (39,886 bytes)

**Therefore**: .job → .jxl reverse conversion IS REQUIRED to access field observations in readable format.

### The Converter
- **Executable**: `TrimbleAccess.JobConverter.ConverterProcess.exe` (.NET 4.7.2, runs under Wine)
- **Currently used**: `--command=jxl-to-job` (forward direction, for job creation)
- **Needed**: `--command=job-to-jxl` (reverse direction, for field data parsing)
- **STATUS**: The reverse command has NEVER been tested in Docker/Wine. This is the #1 blocker for this feature.

### How to Test
```bash
docker exec -it trimble-sync bash -c "
  cd /app/trimble-converter/JobConversion && \
  wine TrimbleAccess.JobConverter.ConverterProcess.exe \
    --command=job-to-jxl \
    --inPath=/data/office/{some-job}/Field_Data/{timestamp}/{jobfile}.job \
    --outPath=/tmp/test-converted.jxl \
    --convertersPath=/app/trimble-converter/JobConversion \
    --geodataPath=/app/trimble-converter/geodata
"
```

### Insertion Point in Upload Pipeline
Between step 5 (files written to disk) and step 8 (CSV extraction):
```
5. Write files to disk
5.5 NEW: Find .job file in uploaded files
5.6 NEW: Run wine converter: job-to-jxl
5.7 NEW: Parse converted .jxl with xml2js
5.8 NEW: Build survey_summary in JSON
6. Update job metadata
7. Extract CSV data (unchanged)
8. Build field_status.json (include survey_summary)
9. Log completion
10. Queue HiveMind notification (include survey_summary)
11. Return response
```

### CRITICAL TIMING: Conversion MUST Complete BEFORE HiveMind Notification
The .job → .jxl conversion and subsequent JXL parsing MUST be fully complete BEFORE the notification is written to events.jsonl. HiveMind watches this file — once it sees the notification, it absorbs it immediately. If the conversion isn't done yet, HiveMind gets incomplete data and there's no retry mechanism. The notification must contain the complete parsed JXL data on first fire.

### Async vs Sync
**Recommended: Async with delayed notification** — Return upload success to controller immediately, convert in background, fire notification ONLY AFTER conversion completes. This avoids delaying the controller's response while ensuring HiveMind gets complete data. The existing notification at step 11 of the upload pipeline must be MOVED to after the conversion completes, not fired in its current location.

### Feature Flag
`JOB_TO_JXL_CONVERSION_ENABLED` in `config.js` and `docker-compose.yml`

---

## 14. JXL PARSING TO JSON FOR HIVEMIND

### CRITICAL: Check HiveMind First
HiveMind may ALREADY have JXL parsing logic. Before building anything new, the new instance MUST:
1. **Audit HiveMind's codebase** for any existing JXL/XML parsing — there is likely logic already in place for consuming JXL data from the current workflow
2. **Build onto what already exists** rather than duplicating — if HiveMind already parses JXL, extend that logic rather than creating a parallel parser in Data Sync
3. **Determine the right boundary** — does the parsing belong in Data Sync (producing JSON for HiveMind to consume) or in HiveMind itself (receiving the raw .jxl and parsing it)?

The whole point of the JXL conversion is so HiveMind can enrich the job index with absolutely ALL information about the field work completed — errors for each point, time, what each point was staked to, GNSS quality, every observation, everything. This is the reason the .job→.jxl conversion exists.

### Extracting ABSOLUTELY ALL Information
It is imperative that literally ALL information is extracted from the JXL. Not a subset. Not a summary. Everything. Every point, every observation, every error, every timestamp, every coordinate, every quality indicator, every stakeout record, every deleted/overwritten point. The goal is that HiveMind has complete knowledge of everything that happened in the field, enabling rich conversations about the field data with no gaps.

### What xml2js Provides
`xml2js` (already in `package.json`) does lossless XML → JSON conversion. Every element, attribute, text node, and nesting level is preserved. Example:

```xml
<PointRecord ID="00000045">
  <Name>0206031</Name>
  <Code>FIP</Code>
  <Grid>
    <North>5260123.456</North>
    <East>304567.890</East>
    <Elevation>45.123</Elevation>
  </Grid>
</PointRecord>
```

Becomes:
```json
{
  "PointRecord": {
    "$": { "ID": "00000045" },
    "Name": ["0206031"],
    "Code": ["FIP"],
    "Grid": [{
      "North": ["5260123.456"],
      "East": ["304567.890"],
      "Elevation": ["45.123"]
    }]
  }
}
```

### What to Parse from FieldBook
- **PointRecord** — Point ID, coordinates (N, E, Elevation), classification
- **GPSPosition / GPSObservation** — GNSS quality (PDOP, HDOP, solution type, occupation time)
- **StakeoutRecord** — Stakeout target points, actual positions, deltas
- **RoundRecord / TSObservation** — Total station observations
- **DeletedRecord** — Overwritten/deleted points

### What's Missing
A real field-collected `.jxl` file is needed to confirm the exact element names and structure. The template JXL only has coordinate system config — no FieldBook point data. The parser can only be built correctly once a real converted field .jxl is available.

### Where Does the Parsed JXL Data Go? — OPEN QUESTION FOR THE NEW INSTANCE
The previous sessions proposed including a `survey_summary` JSON object in both `field_status.json` and the HiveMind notification payload. But this is NOT a decided design — the new instance must determine the right approach:

1. **Option A: Parsed data goes into `field_status.json` and notification payload** — Data Sync does the parsing, produces a JSON summary, embeds it in the existing `field_status.json` and the `events.jsonl` notification. HiveMind receives pre-parsed data.
2. **Option B: The .jxl file is just left on disk and HiveMind reads/parses it directly** — Data Sync only handles the .job → .jxl conversion. HiveMind finds the .jxl file and does its own parsing. This may already be partially implemented in HiveMind.
3. **Option C: Both** — The .jxl file stays on disk AND a parsed summary goes in the notification, giving HiveMind both the raw file and structured data.

**The right answer depends entirely on what HiveMind already does. DO NOT design or implement ANY JXL parsing or field_status.json integration until:**
1. HiveMind's codebase has been fully audited for how it currently handles JXL/XML data
2. The new instance has mapped out exactly how Data Sync and HiveMind interface — every touchpoint, every file, every notification, every path reference
3. The new instance has reported ALL findings to Nick with a clear explanation of how everything currently works and how it all interfaces
4. The new instance has presented recommendations with pros/cons for each approach
5. **Nick has reviewed and approved the approach**

This is a decision point that requires Nick's input — not something to be designed or implemented in isolation. Audit first, report findings, present options, get approval, then build.

### Proposed Module (if it's determined Data Sync should do the parsing)
Build `jxlParser.js` using `xml2js` that parses the FieldBook section and returns structured JSON. Include this data in:
- `field_status.json` (per-upload metadata file)
- HiveMind notification payload (via `notifier.js`)
- **But again — do NOT build this until the HiveMind audit is done and Nick approves the approach**

---

## 15. HIVEMIND INTEGRATION MAP

### Single Integration Point
HiveMind's ONLY connection to Data Sync is through one file:
```
/data/notifications/events.jsonl
(NAS path: /volume1/Pardy Surveys/Data Sync/notifications/events.jsonl)
```

### How It Works
- `notifier.js` appends one JSON line per event
- Each line has: `timestamp`, `event` (type), `data` (arbitrary payload)
- Feature-flagged via `NOTIFICATIONS_ENABLED` in `docker-compose.yml` (currently `true`)
- Non-blocking — if write fails, logs error but doesn't affect upload response
- HiveMind reads/tails this file

### Event Types
| Event | Trigger | Key Data |
|-------|---------|----------|
| `layout_job_created` | POST /api/create-job | job_number, address, job_type, folder_path |
| `field_data_uploaded` | POST /api/upload-field-data-android | job_number, field_status, file_count, total_bytes |
| `job_deleted` | POST /api/delete (job folder) | job_number, job_name, folder_path |

### Impact of Changes on HiveMind
| Change | Impact |
|--------|--------|
| nginx auth | **None** — HiveMind reads files, not HTTP endpoints |
| Volume relocation | **Must update its path** to events.jsonl |
| .job→.jxl conversion | **None** — parsed data added to existing notification payload. Additive. |
| Recycle bin | **None** — `job_deleted` event still fires, payload unchanged |

> **VERIFY**: How does HiveMind access events.jsonl? Docker volume mount? SMB share? Direct filesystem? This affects the volume relocation plan.

---

## 16. IMPLEMENTATION PHASES

### Phase 0: Copy Folder to New Location (FIRST STEP)
- **Keep the existing Docker container running with ZERO changes** — it stays untouched until the new one is confirmed working
- Copy the ENTIRE `/volume1/Pardy Surveys/Data Sync/` contents to `/volume1/DataSync/`
- Rename `office-jobs` to `Data Sync` in the new location
- Create a new Docker container called "Data Sync" pointing to `/volume1/DataSync/`
- Update all volume mount paths in the new container's docker-compose.yml
- **Audit every path reference** in every file to ensure correctness with the new location and renamed folder
- **Test**: Start the new container, verify it boots, verify all endpoints respond, verify all file operations work against the new paths
- The old container remains running as fallback

### Phase 1: nginx Auth Proxy (Security First)
- Create `auth-proxy/` directory with docker-compose.yml, nginx/nginx.conf, authelia/configuration.yml, authelia/users_database.yml
- Change `trimble-sync/docker-compose.yml`: `ports: "3000:3000"` → `expose: "3000"` + add shared network
- Create Docker network `pardy-auth-net`
- Configure path exemptions for 5 Android native HTTP calls
- Update Synology reverse proxy to point to nginx (port 8080) instead of port 3000
- Generate bcrypt/argon2 password hashes for users
- Generate random secrets for JWT and session
- Configure SSL cert paths
- **Test**: PC browser login, WebView login, native upload, native download, health checks

### Phase 2: Recycle Bin + Delete Security
- Create `recycleBin.js` module
- Modify delete endpoint: move to `.recycle/` instead of `fs.rm()`
- Add `validatePath()` to delete endpoint
- Add delete logging to `logger.js` (new `deleteAction` method)
- Add feature flag `RECYCLE_BIN_ENABLED`
- Filter `.recycle/` from `buildFolderTree()`
- Optional: auto-cleanup of items older than 30 days
- **Test**: delete via UI, verify files in .recycle/, verify notification still fires

### Phase 3: Volume Relocation (MOVED TO PHASE 0)
Volume relocation is now Phase 0 — it happens FIRST, before any code changes. See Phase 0 above. This phase now covers the post-migration cleanup:
- Update HiveMind's path to events.jsonl (coordinate with HiveMind handoff document)
- Update Joe's Synology Drive sync target
- Keep old container running as read-only fallback until new container is confirmed
- Produce the HiveMind Handoff Document (see Section 20, item 9)
- **Test**: full upload/download cycle on new container, HiveMind receives notifications from new location

### Phase 4: .job → .jxl Conversion
- **FIRST**: Test `--command=job-to-jxl` with a real field .job file inside Docker container
- If works: build `jxlParser.js` module using xml2js
- Integrate async conversion into upload handler
- Add feature flag `JOB_TO_JXL_CONVERSION_ENABLED`
- Include parsed data in field_status.json and notification payload
- **Test**: upload from controller, verify .jxl created, verify JSON summary in notification

### Additional Security Fixes (can be done with any phase)
- Add `validatePath()` to ALL endpoints that accept user-supplied paths
- Fix XSS in OAuth callback (escape query params)
- Remove/disable `/api/test-jxl` debug endpoint
- Add trailing path separator to download-file path check
- Sanitize filenames in upload
- Add size cap to pendingFieldStatus Map
- Add depth limit to buildFolderTree
- Stop leaking internal paths in error responses

---

## 17. WHAT STILL NEEDS TESTING

| Item | How to Test | Risk if it Fails |
|------|-------------|------------------|
| `--command=job-to-jxl` reverse conversion in Wine | Run in Docker with a real field .job file | Entire Phase 4 blocked |
| Synology DSM API from Docker (`host.docker.internal:5000`) | `curl` from inside the Docker container | nginx auth can't validate credentials against NAS |
| FileDownloadManager auth exemption | Test download from controller after nginx is deployed | Controllers can't download jobs |
| Volume relocation — HiveMind path | Relocate and verify HiveMind still reads events | HiveMind stops receiving notifications |
| `.recycle/` directory permissions in Docker | Create `.recycle/` and test `fs.rename()` across same filesystem | Recycle bin moves fail |
| Real field .jxl FieldBook structure | Convert a field .job and examine the XML | Parser design depends on actual element names |
| SSL certificate export from Synology | Verify certs can be mounted into nginx container | nginx can't terminate HTTPS |

---

## 18. CORRECTIONS BETWEEN SESSIONS

These errors were caught across sessions:

1. **Session 1 assumed .jxl is uploaded from field** — WRONG. The Android app only uploads .job files. Session 1 corrected itself after Nick challenged the assumption.

2. **Session 1 said "No other native HTTP calls exist besides uploadFilesToServer and checkServerHealth"** — WRONG. Session 2 found `FileDownloadManager.java` with 2 additional native HttpURLConnection endpoints (download-job, download-file) with NO cookies AND NO custom headers.

3. **Session 1 missed 12 security vulnerabilities** — Session 2 found: command-line flag injection, path traversal on create-job and generate-job-file, template path traversal, no CSRF, unbounded pendingFieldStatus, download-file off-by-one, internal path leaks, buildFolderTree no depth limit, host header reflection, Content-Disposition injection, individual file deletion not separately called out.

4. **Session 3 initially suggested Synology DSM portal authentication might share cookies with HttpURLConnection** — This was corrected within the same session after deeper investigation. WebView and HttpURLConnection do NOT share cookies on Android.

---

## 19. USER CONSTRAINTS AND NON-NEGOTIABLES

1. **ZERO changes to the Android APK** — The app must not be rebuilt. All 5 native HttpURLConnection calls must continue working.
2. **ALL changes must be purely additive** — No modifications to existing function signatures, API response formats, or endpoint behavior.
3. **Feature flags for everything** — System must work identically with flags set to false.
4. **No breaking changes** — Existing upload, download, sync, create, delete flows must continue to work. Users must not notice any difference (except the login page).
5. **Login once per year** — On both PC browsers and Android controllers. Not every time. Not every month. Once a year.
6. **Reusable auth for future apps** — The nginx/Authelia setup must be able to protect additional Docker containers (HiveMind, Email Automation, etc.) with the same login.
7. **Conversion must not use controller resources** — .job → .jxl conversion happens server-side in Docker, not on the TSC5 field device.
8. **Conversion MUST complete before HiveMind notification** — No race conditions. HiveMind watches events.jsonl and absorbs notifications immediately. The notification must contain the complete parsed JXL data on first fire. There is no retry. If conversion isn't done when the notification fires, HiveMind gets incomplete data permanently.
9. **Keep existing Docker running** — The current Docker container must remain running with absolutely zero changes until the new one at the new location is confirmed fully functional. No exceptions.
10. **HiveMind Handoff Document** — After all changes are complete, a document must be produced listing every single change made to Data Sync (paths, renames, configs, endpoints) so HiveMind can be updated accordingly by a separate instance.
11. **Absolutely ALL information from JXL** — The JXL parsing must extract literally everything — every point, every observation, every error, every timestamp, every coordinate, every quality indicator. No summaries, no subsets. Everything.
12. **Comprehensive request forensics** — Every request must be logged with absolutely everything technically possible about the requester. This is critical — there have been multiple incidents of unauthorized access to company data, including the mass deletion on Feb 7, 2026. We need enough information to pinpoint who is accessing the system and have sufficient evidence to report incidents to the authorities if needed. This is purely additive — it must NOT break any existing functionality. It gets built in alongside the new security integration (nginx/Authelia), not as a separate layer that could interfere.
13. **Everything must be vetted, tested, verified, and tested again** — Every single feature, every change, every new module, every configuration must be independently audited against the existing codebase, tested for correctness, verified to not break anything, and tested again after integration. Nothing goes live without being proven to work. The new instance must describe exactly HOW each feature will be tested and what constitutes a pass/fail for each test. No assumptions. No "this should work." Prove it works.

---

## 20. INSTRUCTIONS FOR THE NEW INSTANCE

**YOU MUST ABSOLUTELY AUDIT ALL EXISTING CODE.** Every file. Every function. Every endpoint. Every line of configuration. Fact-check everything in this document against the actual source code. Verify every claim. Test every assumption. Do not take ANYTHING in this document at face value — it was compiled from 3 separate Claude sessions and there were errors between them (see Section 18). Your job is to independently confirm or correct everything.

You are being given this document so you can:

1. **Read every single code file** listed in Section 3. All of them. Completely. Do not skip any. Read them yourself. Do not assume the descriptions in this document are accurate.

2. **Independently verify** every claim in this document. Do not trust line numbers, assumptions, or conclusions. Confirm them against the actual source code. Previous instances got things wrong — you might find more errors.

3. **Identify anything that was missed** — Look at every endpoint, every middleware, every path operation, every HTTP call in the Android app. Check for security issues not listed here. Look for edge cases. Look for race conditions. Look for anything that could break.

4. **Check HiveMind for existing JXL parsing** — Before designing the JXL parsing solution, audit HiveMind's codebase. There is likely existing logic for consuming JXL data. Build onto that rather than duplicating.

5. **Produce a complete implementation plan** covering all items in Section 1 (What The User Wants), organized by the phases in Section 16. The FIRST physical step is copying the entire Data Sync folder to its new location.

6. **Ensure the plan is bulletproof** — The user wants to give this plan to yet another Claude Code instance for independent review before implementation. Nothing should be left ambiguous. Every file change, every new file, every configuration value should be specified.

7. **Do not implement anything** unless explicitly told to. The first step is audit and plan. Implementation comes after the plan is reviewed and approved.

8. **Be honest about gaps** — If you find something that contradicts this document, flag it. If there's something you can't verify, say so. The user values thoroughness over speed.

9. **Produce a HiveMind Handoff Document** — After the implementation plan is finalized, produce a separate document that lists every single change made to Data Sync. For EVERY change, the handoff document must include:
   - **What changed** — the specific file, path, config, endpoint, folder, etc.
   - **What it's doing** — what the change accomplishes and why it exists
   - **Why it's doing it** — the reasoning behind the change
   - **The old way** — exactly how it worked before (old path, old config value, old behavior)
   - **The new way** — exactly how it works now (new path, new config value, new behavior)

   This must cover EVERY change — every path change, every renamed folder, every moved file, every new endpoint, every modified endpoint, every config change, every volume mount change, every new module, every new feature. No surprises for HiveMind. The HiveMind instance reading this document must be able to understand the complete picture of what changed and update all HiveMind references accordingly without having to guess or investigate.

   Additionally: all findings from this document (the combined assessment) and the previous sessions must be preserved. Do not discard or overwrite information from the earlier sessions — keep it all, even if some of it was corrected. The correction history itself is valuable context.

10. **Ensure ALL paths are correct** — The volume relocation + office-jobs rename means every single path in the system changes. You must audit every path reference in every file — server.js, docker-compose.yml, config.js, notifier.js, the Python scripts, everything — and produce an exhaustive list of what changes. Get ALL paths correct. Missing even one will cause failures.

11. **Request forensics is ADDITIVE — must not break anything** — The comprehensive request logging / visitor forensics (Section 21) is a new capability that gets built into the security integration alongside nginx/Authelia. It must be purely additive. The fingerprinting JavaScript must not interfere with the existing React app, the Android WebView, or any native HTTP calls. The logging middleware must not add latency or change any response. If the forensics feature flag is off, the system must behave identically to before.

12. **Test plan for EVERY feature** — Your implementation plan must include a concrete, specific test plan for every single feature. Not vague "test it works" — specific steps: what to test, how to test it, what the expected result is, what constitutes a failure. Every feature must be independently verified before integration, and verified again after integration with other features. Include regression tests that prove existing functionality still works after each change. Nothing is assumed to work. Everything is proven.

---

## 21. COMPREHENSIVE REQUEST LOGGING / VISITOR FORENSICS

### Requirement
Every single request that reaches the server — authenticated or not, successful or not, legitimate or malicious — must be logged with absolutely every piece of information that can technically be extracted about the requester. This is a forensics-first approach: if someone accesses this URL, we want to know everything about them that is possible to capture.

### What the New Instance Must Do
This feature has NOT been audited or designed yet. The new instance must:
1. **Research exhaustively** what information can be captured from an HTTP request at the nginx layer and the Express.js layer
2. **Determine what is technically possible** — not just common fields, but absolutely everything that can be extracted from any request
3. **Design the logging architecture** — where to log (separate file? database? structured JSON?), how to store, how to query
4. **Consider the mass deletion incident** (Feb 7, 2026) — if this logging had existed, what would we have known about the attacker?

### Information to Capture (at minimum — the new instance must identify MORE)
This is a STARTING POINT. The new instance must research and expand this list with everything else that's possible:

**Network/Connection Level:**
- Source IP address (the real one — consider X-Forwarded-For, X-Real-IP behind reverse proxy)
- Source port
- Connection protocol (HTTP/1.1, HTTP/2, etc.)
- TLS version and cipher suite (since it's behind HTTPS)
- TCP connection timing
- Whether the connection is keep-alive or new

**HTTP Request Level:**
- Full URL requested (path, query string, fragment)
- HTTP method (GET, POST, PUT, DELETE, etc.)
- All request headers — every single one, not just common ones
- User-Agent string (full, untruncated)
- Accept, Accept-Language, Accept-Encoding headers (reveals browser/OS/language)
- Referer header (where they came from)
- Origin header
- Cookie headers (what cookies they're presenting — NOT the values of auth cookies, just their existence)
- Content-Type and Content-Length
- Authorization header presence (not the token value)
- Custom headers (X-* headers — the Android app sends TrimbleSync/ user agent)
- If-Modified-Since, If-None-Match (caching behavior)
- DNT (Do Not Track) header
- Sec-Fetch-* headers (Sec-Fetch-Mode, Sec-Fetch-Site, Sec-Fetch-Dest — reveals how the request was initiated)
- Connection header
- Upgrade-Insecure-Requests header

**Request Body (where applicable):**
- POST body size
- Uploaded file names, sizes, types (NOT the file contents)
- Form field names submitted

**Timing:**
- Exact timestamp of request (ISO 8601 with timezone, millisecond precision)
- Request processing duration
- Time between sequential requests from same IP (request frequency/pattern)

**Authentication:**
- Whether request was authenticated or unauthenticated
- Which user (if authenticated via Authelia)
- Whether auth was attempted and failed
- Session age (how old is the auth cookie)

**Response:**
- HTTP status code returned
- Response size
- Response time

**Behavioral/Pattern Analysis:**
- Request rate from this IP (requests per minute/hour)
- Sequential endpoint access pattern (what did they hit in what order)
- Whether the request matches known Android app patterns vs browser vs unknown
- Geographic lookup of IP (GeoIP — country, region, city, ISP)
- Reverse DNS of source IP
- Whether the IP has been seen before and when

**Passive Fingerprinting (server-side, from what they send us):**
- TLS fingerprinting (JA3/JA4) at the nginx level — uniquely identifies client software based on how it negotiates TLS
- Header ordering and capitalization — different browsers/tools send headers in different orders, this is a fingerprint
- Accept-Language + User-Agent + timezone combination — narrows down individual identity
- Synology's built-in firewall/logging — can it be leveraged for additional data?
- What can be inferred from HTTP/2 settings frames, window sizes, priority signals?

### Active Fingerprinting — Sending Something Back to THEIR Browser

**The new instance must research this thoroughly and hold NOTHING back.** The concept: when someone hits the server via a browser, the response includes JavaScript that runs on THEIR device, collects absolutely everything possible about them, and sends it back to us. This is how commercial fingerprinting services (like FingerprintJS) work. We want every single thing that is technically possible. The new instance must go deeper than this list — this is a starting point, not the ceiling.

**What is possible to collect via JavaScript running in their browser:**

*Hardware/Device:*
- Screen resolution (actual and available), pixel density (`devicePixelRatio`), color depth
- Number of CPU cores (`navigator.hardwareConcurrency`)
- Device memory (`navigator.deviceMemory`)
- GPU vendor, renderer, and full capabilities (via WebGL `WEBGL_debug_renderer_info` — very unique per hardware configuration)
- Touch support / pointer type (mouse vs touch vs stylus) / max touch points
- Battery level and charging status (Battery Status API — if available, reveals if they're on a laptop vs plugged in)
- Media devices — number of cameras, microphones, and speakers (`navigator.mediaDevices.enumerateDevices()` — returns count and device IDs WITHOUT accessing them)
- Storage quota estimates (`navigator.storage.estimate()` — can reveal approximate disk size)
- Gamepad API — whether game controllers are connected (niche but unique)
- Bluetooth availability (`navigator.bluetooth` — just whether the API exists, not pairing)

*Browser/Software:*
- Every installed font on their system (via canvas measurement technique or `document.fonts` API — the set of installed fonts is highly unique per machine)
- Browser plugins and extensions (what's detectable via feature probing)
- Platform / OS (from `navigator.platform`, `navigator.userAgentData` for newer browsers)
- Exact browser version via feature detection (which specific APIs are supported narrows it down precisely)
- Installed language packs and preferred languages (`navigator.languages` — full ordered list)
- Permission states for every API: notifications, geolocation, camera, microphone, clipboard, MIDI, etc. (`navigator.permissions.query()` — returns "granted", "denied", or "prompt" — reveals what sites they've previously granted access to)
- Do Not Track setting (`navigator.doNotTrack`)
- Cookie enabled (`navigator.cookieEnabled`)
- PDF viewer built-in or plugin
- WebDriver detection (`navigator.webdriver` — reveals if automated/bot)
- Speech synthesis voices (`speechSynthesis.getVoices()` — installed TTS voices are system-specific)
- Keyboard layout detection (via `KeyboardEvent.code` vs `KeyboardEvent.key` on injected events)

*Unique Device Fingerprint Hashes (these are the most powerful — persist across IP changes, VPNs, cookie clears):*
- **Canvas fingerprint** — render hidden text/shapes on a canvas element, call `toDataURL()` — produces a hash unique to the device's GPU, driver version, font rendering, and anti-aliasing. Different on every machine.
- **WebGL fingerprint** — full parameter dump: vendor, renderer, max texture size, supported extensions, shader precision format, max viewport dimensions. Extremely unique per GPU.
- **AudioContext fingerprint** — create an `OfflineAudioContext`, process a signal through an oscillator and compressor, hash the output. Audio processing is hardware-dependent and produces a unique signature.
- **Font fingerprint** — measure the rendered width/height of test strings in every common font. The set of available fonts is nearly unique per OS install.
- **CSS feature fingerprint** — which CSS features are supported (via `@supports` queries) reveals exact rendering engine version
- These combined create a device ID that is **extremely difficult to fake or change** — it persists through cookie clears, private browsing, VPN changes, IP changes, and even browser reinstalls (as long as the hardware stays the same)

*Network (from their side — things only their browser can tell us):*
- **WebRTC local IP leak** — creating an `RTCPeerConnection` with STUN servers can reveal the client's real local/private IP AND sometimes their public IP even if they're behind a VPN or proxy. This is a well-known technique.
- Connection type, downlink speed, effective type, RTT (`navigator.connection` — Network Information API — WiFi vs cellular vs ethernet, estimated bandwidth)
- Timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone` — exact timezone like "America/St_Johns", not just offset)
- Full locale information (`Intl` API — number formatting, date formatting, currency preferences)
- System language vs browser language (can differ and reveals configuration)
- Viewport size, window outer/inner dimensions, screen orientation
- Whether they're in fullscreen, picture-in-picture, or have the window focused

*Behavioral (collected over time during their session):*
- Mouse movement patterns (speed, acceleration, jitter — can be as unique as a fingerprint)
- Typing cadence and speed if they interact with any input fields
- Scroll behavior (speed, smoothness — trackpad vs mouse wheel vs touch)
- Click patterns (single click speed, double click timing)
- Idle detection (`IdleDetector` API if permitted)
- Page visibility changes (when they tab away and come back — `visibilitychange` event)
- Copy/paste behavior
- Time spent on each part of the page

*Exact Location — YES, THIS IS POSSIBLE:*
- **Browser Geolocation API** (`navigator.geolocation.getCurrentPosition()`) — provides **exact GPS latitude, longitude, altitude, speed, and heading** with meter-level accuracy
- **On a normal browser**: this triggers a permission popup ("This site wants to know your location"). The user can deny it.
- **On Android WebView**: this is the critical part — **the Android app's `MainActivity.java` code controls geolocation permissions for the WebView**. The new instance MUST check `MainActivity.java` for:
  - `WebChromeClient.onGeolocationPermissionsShowPrompt()` — if this is overridden to auto-grant (`callback.invoke(origin, true, false)`), then the WebView can silently get exact GPS location with NO popup
  - `WebSettings.setGeolocationEnabled(true)` — enables the API in WebView
  - If these are already configured (or can be configured in a future app update), every Android controller that connects would silently report its exact GPS coordinates
- **Even without Geolocation API**: IP geolocation (GeoIP databases like MaxMind) gives city-level accuracy without any permission. ISP identification is always available from IP.
- **WiFi-based geolocation**: Some browsers expose nearby WiFi networks which can be cross-referenced for location — research whether this is accessible
- The new instance must audit `MainActivity.java` and determine what geolocation capability already exists or could be enabled

*Timing Attacks & Side Channels (advanced — the new instance should research feasibility):*
- Cache timing — probing whether certain resources are in the browser cache reveals what other sites they've recently visited
- CSS `:visited` link detection (mostly patched in modern browsers but worth checking in Android WebView)
- Performance API timing (`performance.getEntriesByType('resource')`) — reveals exact load times for every resource, can detect network characteristics
- SharedArrayBuffer timing (if available) — high-resolution timer for more precise fingerprinting
- Whether the browser has specific fonts installed reveals OS version and installed software packages

**How to implement it:**
- A small JavaScript module injected into every HTML page served by Express (added to `public/app.js` or as a separate script loaded by all pages)
- OR injected at the nginx level into all HTML responses (more comprehensive — catches even error pages)
- Runs silently on page load, collects everything, sends results via async `fetch()` POST to a dedicated `/api/forensics` endpoint
- Must be invisible/transparent — no visible UI, no performance impact the user would notice
- Must work on both PC browsers AND the Android WebView (which IS a browser and CAN run JavaScript)
- Will NOT work on native HttpURLConnection requests (those aren't browsers, can't execute JS) — for those we rely on passive fingerprinting only
- Should collect on first page load AND periodically during the session (some data like battery level, geolocation, connection type can change)
- Should also fire on specific events: failed login attempts, accessing sensitive endpoints, any delete operations

**Composite device fingerprint:**
- Combine ALL collected signals (canvas hash + WebGL hash + AudioContext hash + font hash + screen + hardware + all other signals) into a single unique device ID
- Track this ID in a persistent database over time — even if the person changes their IP, uses a VPN, clears all cookies, uses private browsing — the device fingerprint stays the same
- Cross-reference with passive data (TLS fingerprint, header fingerprint, IP geolocation) for maximum identification power
- Build a profile over time: "Device X was seen from IP A on date 1, IP B on date 2, IP C on date 3" — track their movements

**What about non-browser requests?**
- Native HttpURLConnection (Android app uploads/downloads), curl, scripts, bots — these can't run JavaScript
- For these, we're limited to passive fingerprinting only (TLS fingerprint, headers, IP, timing, behavioral patterns)
- But TLS fingerprint alone (JA3/JA4 hash) can distinguish between curl, Python requests, Go http client, HttpURLConnection, Node.js fetch, every specific browser version, etc. — it's extremely powerful for identifying the client software
- Header ordering fingerprint is also very effective for non-browser clients

**Commercial libraries to evaluate:**
- **FingerprintJS** (open source version and paid Pro version) — the most well-known browser fingerprinting library. Pro version claims 99.5% identification accuracy.
- **ClientJS** — another fingerprinting library
- The new instance should evaluate: do these work in Android WebView? What's the accuracy? What data do they collect that we might miss with a custom solution? Is the open source version sufficient or is Pro needed?
- Consider: is there anything these libraries collect that isn't listed above? If so, add it.

**The new instance must go beyond this list.** Research what ELSE is technically possible. Check recent browser fingerprinting research papers. Check what FingerprintJS Pro collects. Check what the Tor Browser specifically tries to block (because that's a list of what's effective). If there's something collectible that isn't listed here, add it. We want EVERYTHING.

### Storage
- Logs must be structured (JSON lines or similar) for easy querying
- Must be stored separately from application logs
- Must include rotation/retention policy
- Must be queryable — "show me everything from IP X" or "show me all unauthenticated requests in the last 24 hours"
- Consider feeding into HiveMind for analysis (via a separate notification channel or direct file access)

### WHEN DOES THIS FIRE? — IMMEDIATELY. NO LOGIN REQUIRED.
- **Passive fingerprinting** (IP, TLS fingerprint, all headers, GeoIP) is captured the instant the connection hits the server — before any page loads, before login, before anything. nginx captures this on the raw connection.
- **Active fingerprinting** (JavaScript — canvas, WebGL, AudioContext, device info, WebRTC, etc.) fires as soon as the HTML page renders in their browser. The login page itself must contain the fingerprinting script. So even if an attacker loads the login page and immediately closes the tab, we already have their full device fingerprint, IP, geolocation, hardware profile, and everything else.
- **NONE of this requires authentication.** The whole point is to capture data about UNAUTHENTICATED visitors — especially attackers who will never log in.
- Login only tells us their NAME. The forensics system tells us everything else regardless.

### Feature Flag
`REQUEST_FORENSICS_ENABLED` — but even when the main app features are flagged off, this logging should be one of the first things turned on. We want to capture data from day one.

### Integration Points
- **nginx layer**: Can capture TLS details, raw headers, timing — things Express never sees
- **Express.js layer**: Can capture application-level details (which endpoint, auth status, business logic context)
- **Both layers should log** — nginx access log in forensic format PLUS Express middleware logging
- Must not impact request performance noticeably

### Why This Matters — CRITICAL CONTEXT
There have been MULTIPLE incidents of unauthorized access to Pardy Surveys' data. The most severe was the mass deletion on Feb 7, 2026, where 18 job folders were deleted via the unauthenticated delete endpoint. Data was only recovered because an employee happened to have Synology Drive sync running on his laptop. If forensic logging had existed, we would know the attacker's IP, their User-Agent, their request pattern leading up to the delete, what else they accessed, their geographic location, and potentially identify them with enough evidence to report to law enforcement.

This is not theoretical. This company has been targeted. We need enough information captured on every single request that if another incident occurs, we can:
1. **Pinpoint exactly who did it** — IP, location, ISP, device fingerprint, access pattern
2. **Build a timeline** — what they accessed, in what order, over what time period
3. **Provide actionable evidence to authorities** — enough detail that law enforcement can act on it
4. **Detect patterns** — recognize if the same actor comes back from a different IP based on fingerprint similarities

Every request. Every visitor. Everything possible captured. No exceptions.

---

*This document was compiled on February 8, 2026, from chat history files in `\\PS-NAS\Pardy Surveys\Data Sync\Chat History\`. It covers sessions: Datasync 1, Datasync 2, Datasync 3, and the markdown plan document. All content is based on actual code reads performed across those sessions. Updated with additional requirements from Nick Pardy on February 8, 2026.*
