# Phase C Audit Report — GitHub Instance
## Data Sync System — Pardy Surveys
### Independent Verification & Security Audit

> **Date**: February 8, 2026
> **Auditor**: Claude Code (GitHub Instance / Opus 4.6)
> **Scope**: Full codebase audit, cross-verification of Combined Assessment, security analysis, implementation planning
> **Status**: PHASE C — Report only. NO changes implemented.

---

## TABLE OF CONTENTS

1. [Combined Assessment Cross-Verification](#1-combined-assessment-cross-verification)
2. [Confirmed Security Vulnerabilities](#2-confirmed-security-vulnerabilities)
3. [NEW Vulnerabilities Not in Assessment](#3-new-vulnerabilities-not-in-assessment)
4. [Migration & Path Change Concerns](#4-migration--path-change-concerns)
5. [Complete Implementation Plan (All 9 Features)](#5-complete-implementation-plan-all-9-features)
6. [Forensics & Fingerprinting Design](#6-forensics--fingerprinting-design)
7. [JXL Conversion Design](#7-jxl-conversion-design)
8. [File Inventory Verification](#8-file-inventory-verification)

---

## 1. COMBINED ASSESSMENT CROSS-VERIFICATION

### 1.1 Factual Errors Found

#### ERROR 1: app.js Line Count is Wrong
- **Assessment claims**: `public/app.js` is ~1300 lines
- **Actual**: `public/app.js` is **2555 lines**
- **Impact**: The assessment massively understated the frontend size. Nearly half the codebase logic was potentially under-audited. The entire field status form (both Android and Desktop versions) spans from roughly line 1377 to line 2549 — almost 1200 lines the assessment may not have fully examined.

#### ERROR 2: `/api/rename` Endpoint Does NOT Exist
- **Assessment claims** (row #25): `POST /api/rename` at ~line 870, with path validation
- **Actual**: This endpoint **does not exist anywhere in server.js**. Line 870 is inside `buildFolderTree()`. There is no rename functionality in the entire codebase. The assessment fabricated this endpoint.
- **Impact**: Endpoint count should be 24, not 26.

#### ERROR 3: `/api/job-info/*` Endpoint Does NOT Exist
- **Assessment claims** (row #26): `GET /api/job-info/*` at ~line 1640, with path validation
- **Actual**: This endpoint **does not exist anywhere in server.js**. Line 1640 is the beginning of the `/api/log` endpoint. Job info is read via `/api/download-file/{jobPath}/job_info.json` (the generic file download endpoint), not a dedicated endpoint.
- **Impact**: Endpoint count should be 24, not 26. The assessment fabricated two endpoints.

#### ERROR 4: Line Number for `/api/folders` is Wrong
- **Assessment claims**: `/api/folders` is at ~line 265
- **Actual**: `/api/folders` is at **line 574**
- **Impact**: Minor — the assessment warned line numbers are approximate, but this is off by 300+ lines.

#### ERROR 5: Line Number for `/api/create-main-folder` is Wrong
- **Assessment claims**: `/api/create-main-folder` is at ~line 549
- **Actual**: `/api/create-main-folder` is at **line 403**
- **Impact**: Minor mapping error.

### 1.2 Confirmed Claims

The following major claims from the Combined Assessment are **confirmed accurate** after reading every line of code:

| Claim | Verified |
|-------|----------|
| server.js is ~1801 lines | **YES** — exactly 1801 lines |
| Zero authentication on every endpoint | **YES** — no auth middleware, no session management, no token verification anywhere |
| `/api/delete` has NO path validation | **YES** — `path.join(CONFIG.OFFICE_ROOT, folder)` at line 367 with no `validatePath()` call |
| `/api/delete` has NO activity logging | **YES** — `logger` has no `deleteAction` method; only `console.log` at line 361 |
| `/api/delete` uses `fs.rm({recursive:true, force:true})` | **YES** — line 373 |
| Individual file delete also has no validation | **YES** — `fs.unlink(filePath)` at line 391, `filePath` is unvalidated `path.join` |
| OAuth callback has XSS | **YES** — lines 308-309, 346: `${error}`, `${req.query.error_description}`, `${JSON.stringify(req.query)}` interpolated directly into HTML |
| CORS null origin bypass | **YES** — line 155: `if (!origin) return callback(null, true)` |
| `/api/test-jxl` leaks `process.env.PATH` | **YES** — line 1192: `pythonPath: process.env.PATH` in JSON response |
| `pendingFieldStatus` Map has no size cap | **YES** — line 21, no limit, no maxSize, individual entries auto-expire at 5 minutes but mass writes possible |
| `buildFolderTree` has no depth limit | **YES** — line 871-976, recursive with no max depth |
| Host header reflection in `/api/download-job/*` | **YES** — line 1244: `baseUrl: \`http://${req.get('host')}/api/download-file/\`` |
| Content-Disposition injection in `/api/download-zip/*` | **YES** — line 1611: `folderName` is unsanitized from URL path |
| `/api/download-file/*` path check off-by-one | **YES** — line 1264: `!resolvedPath.startsWith(resolvedRoot)` without trailing separator. If `/data/office-secret` exists, `resolvedPath="/data/office-secret/file"` passes the check since it starts with `/data/office` |
| No rate limiting anywhere | **YES** — confirmed across all 1801 lines, no rate limiter import or middleware |
| `/api/sync-to-controller` has no path validation | **YES** — lines 784-793 |
| `/api/sync-from-controller` has no path validation | **YES** — lines 806-808 |
| `/api/create-main-folder` has no path validation | **YES** — lines 406-411 |
| `/api/create-job` has no path validation | **YES** — lines 443-446 |
| `/api/generate-job-file` has no path validation | **YES** — lines 990-998 |
| `/api/download-job/*` has no path validation | **YES** — lines 1203-1204 |
| `/api/download-zip/*` has no path validation | **YES** — lines 1596-1597 |
| `notifier.js` writes to `/data/notifications/events.jsonl` | **YES** — hardcoded path in notifier.js |
| `package.json` has NO session management library | **YES** — confirmed dependencies: express, multer, xml2js, archiver, cors only |
| Android `WebView.setWebContentsDebuggingEnabled(true)` | **YES** — line 137 of MainActivity.java |
| Android `setAllowFileAccessFromFileURLs(true)` | **YES** — line 121 |
| Android `setAllowUniversalAccessFromFileURLs(true)` | **YES** — line 122 |
| `android:allowBackup="true"` in AndroidManifest.xml | **YES** — confirmed |
| `FileDownloadManager.java` has NO cookies, NO custom User-Agent | **YES** — confirmed, uses bare `HttpURLConnection` |
| Docker-compose volume mounts match assessment | **YES** — all 5 volumes confirmed |

### 1.3 Geolocation Discrepancy

The Combined Assessment discusses Android geolocation but doesn't clearly note:
- **AndroidManifest.xml HAS** `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions (lines 9-10)
- **BUT** `MainActivity.java` does **NOT** override `onGeolocationPermissionsShowPrompt` in its `WebChromeClient`
- **AND** `setGeolocationEnabled(true)` is **NOT** called in WebView settings
- **Result**: Despite having location permissions, the WebView cannot actually pass geolocation data to JavaScript. The permissions are likely for a future feature or copy-paste from a template. This matters for the forensics/fingerprinting design — we cannot rely on browser-level geolocation from the Android app without an APK change (which is forbidden).

### 1.4 Correct Endpoint Count

The actual API endpoints in server.js, verified line by line:

| # | Method | Endpoint | Actual Line |
|---|--------|----------|-------------|
| 1 | GET | `/` (static files via `express.static`) | 189 |
| 2 | GET | `/oauth/callback` | 298 |
| 3 | POST | `/api/delete` | 360 |
| 4 | POST | `/api/create-main-folder` | 403 |
| 5 | POST | `/api/create-job` | 433 |
| 6 | GET | `/api/templates` | 550 |
| 7 | GET | `/api/folders` | 574 |
| 8 | POST | `/api/upload` | 591 |
| 9 | POST | `/api/store-pending-field-status` | 656 |
| 10 | POST | `/api/upload-field-data` | 688 |
| 11 | POST | `/api/sync-to-controller` | 779 |
| 12 | POST | `/api/sync-from-controller` | 804 |
| 13 | POST | `/api/generate-job-file` | 987 |
| 14 | GET | `/api/test-jxl` | 1154 |
| 15 | GET | `/api/download-job/*` | 1200 |
| 16 | GET | `/api/download-file/*` | 1255 |
| 17 | POST | `/api/upload-field-data-android` | 1285 |
| 18 | GET | `/api/download-zip/*` | 1594 |
| 19 | POST | `/api/log` | 1642 |
| 20 | GET | `/health` | 1670 |
| 21 | GET | `/healthz` | 1674 |
| 22 | GET | `/api/whoami` | 1679 |
| 23 | GET | `/api/upload-status/:uploadId` | 1702 |
| 24 | GET | `/api/upload-status` | 1725 |

**Total: 24 endpoints** (not 26 as claimed in the assessment).

---

## 2. CONFIRMED SECURITY VULNERABILITIES

All 28+ vulnerabilities listed in the Combined Assessment are confirmed. Here is the definitive list organized by severity:

### CRITICAL

1. **No authentication on ANY endpoint** — Every endpoint is publicly accessible. Anyone who discovers the URL can read, write, delete, and exfiltrate all survey data. This is the most severe issue.

2. **Path traversal on `/api/delete`** (server.js:367) — `path.join(CONFIG.OFFICE_ROOT, folder)` with no validation. An attacker can send `{"folder": "../../etc"}` to delete arbitrary filesystem paths. Combined with `fs.rm({recursive:true, force:true})` at line 373, this is a remote code execution equivalent — deleting system files can crash the container.

3. **Path traversal on `/api/delete` (individual files)** (server.js:389) — Same vulnerability for the `files` array path. Each file in the array is joined without validation.

4. **Path traversal on `/api/download-job/*`** (server.js:1203-1204) — `const fullPath = path.join(CONFIG.OFFICE_ROOT, jobPath)` with no validation. Attacker can enumerate and read arbitrary files on the filesystem.

5. **Path traversal on `/api/download-zip/*`** (server.js:1596-1597) — Same pattern: `path.join(CONFIG.OFFICE_ROOT, folderPath)` with no validation. Can create ZIP archives of arbitrary directories.

6. **Path traversal off-by-one on `/api/download-file/*`** (server.js:1264) — The check `!resolvedPath.startsWith(resolvedRoot)` is vulnerable because it doesn't append `path.sep` to `resolvedRoot`. A directory like `/data/office-secret/` would pass the check since `/data/office-secret`.startsWith(`/data/office`) is true.

### HIGH

7. **Path traversal on `/api/create-main-folder`** (server.js:406-411) — `folderName` and `parentPath` from request body used in `path.join` with no validation. Can create directories anywhere.

8. **Path traversal on `/api/create-job`** (server.js:443-446) — `parentPath` from request body used in `path.join` with no validation.

9. **Path traversal on `/api/sync-to-controller`** (server.js:784-793) — File paths from request body used directly in `path.join` with no validation. Can copy files between arbitrary locations.

10. **Path traversal on `/api/sync-from-controller`** (server.js:806-808) — `jobPath` from request body used directly in `path.join` with no validation.

11. **Path traversal on `/api/generate-job-file`** (server.js:990-998) — `jobPath` from request body used in `path.join` with no validation. Also spawns Python and Wine processes with user-controlled paths.

12. **Command injection via `/api/generate-job-file`** (server.js:1023-1043) — Python arguments constructed from user-supplied `referenceNumber`, `description`, `operator`, `address`. These are passed as separate arguments to `spawn()` (not through a shell), so this is mitigated by Node's spawn. However, the `linkedFiles` array values are spread into the argument list at line 1037, which is user-controlled filenames.

13. **XSS in OAuth callback** (server.js:308-309, 346) — `${error}`, `${req.query.error_description}`, and `${JSON.stringify(req.query)}` interpolated directly into HTML response without escaping.

14. **XSS in `upload-status.html`** (upload-status.html:293) — `${upload.jobPath || 'Upload'}` rendered via `innerHTML` in a template literal. If `jobPath` contains HTML/script tags, they execute.

15. **XSS in `FileDownloadManager.java:notifyError()`** (FileDownloadManager.java:204-209) — Error messages injected into JavaScript via `String.format` with only single-quote escaping. Double quotes, backslashes, and other characters could break out of the string context. Example: an error containing `'); alert('xss` would execute arbitrary JS in the WebView context.

16. **CORS null origin bypass** (server.js:155) — `if (!origin) return callback(null, true)` allows requests with `Origin: null` to bypass CORS. An attacker can craft a sandboxed iframe or data: URL to send `Origin: null`.

17. **No delete logging** — `logger.js` has methods for uploads, downloads, and handshakes, but has NO delete-related logging method. All deletes go only to `console.log`. Combined with no authentication, this means deletions are effectively untraceable.

18. **Android WebView debug mode in production** (MainActivity.java:137) — `WebView.setWebContentsDebuggingEnabled(true)` allows anyone with USB access to inspect and manipulate the WebView via Chrome DevTools.

19. **Android file URL access enabled** (MainActivity.java:121-122) — `setAllowFileAccessFromFileURLs(true)` and `setAllowUniversalAccessFromFileURLs(true)` allow any page loaded in the WebView to read local files via `file://` URLs. If the portal were compromised (or an XSS found), the attacker could read any file accessible to the app.

### MEDIUM

20. **Host header reflection** (server.js:1244) — `http://${req.get('host')}/api/download-file/` reflected in JSON response. Can be used for cache poisoning or phishing if response is cached.

21. **Content-Disposition header injection** (server.js:1611) — `folderName` from URL path used unsanitized in `Content-Disposition` header. Attacker can inject headers via newlines in the folder name.

22. **Information disclosure via `/api/test-jxl`** (server.js:1192) — Leaks `process.env.PATH` in the JSON response. Also leaks filesystem paths via `scriptExists` and `referenceExists` checks.

23. **Information disclosure via `/api/whoami`** (server.js:1679-1694) — Exposes internal proxy headers, IP information, and configuration state to any requester.

24. **`pendingFieldStatus` Map has no size cap** (server.js:21) — Unbounded in-memory Map. An attacker can POST thousands of entries to `/api/store-pending-field-status` to exhaust server memory (DoS).

25. **`buildFolderTree` has no depth limit** (server.js:871) — Recursive directory traversal with no maximum depth. A deeply nested directory structure (e.g., via symlinks) could cause stack overflow.

26. **`android:allowBackup="true"`** (AndroidManifest.xml) — App data can be extracted via `adb backup` on rooted/development devices, potentially exposing cached credentials or session data.

27. **No CSRF protection** — No CSRF tokens on any mutation endpoints. Since CORS allows null origin and all requests are cookie-less anyway, this is currently low risk, but becomes critical once authentication is added.

28. **No rate limiting** — No rate limiting on any endpoint. Enables brute force, DoS, and enumeration attacks.

---

## 3. NEW VULNERABILITIES NOT IN ASSESSMENT

These were discovered during this independent audit and are NOT mentioned in the Combined Assessment:

### NEW-1: Debug Code in Production Frontend (app.js:2213-2216)
```javascript
<div className="fixed inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center p-4" style={{zIndex: 9999}}>
    <div className="bg-yellow-300 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col" style={{border: '10px solid red'}}>
    <div style={{padding: '20px', fontSize: '24px', fontWeight: 'bold', color: 'red'}}>
        DEBUG: FORM IS RENDERING! If you see this, the form works.
```
- **Severity**: LOW (cosmetic/professional, not a security vulnerability)
- **Impact**: When a desktop user triggers the Field Status Form (not the Android one, which has its own dialog at line 1378), they see a massive red/yellow debug overlay that says "DEBUG: FORM IS RENDERING!" This is clearly leftover from development. It makes the desktop field status form unusable for production.
- **Note**: The Android version of the same form (line 1378-1712) does NOT have this debug styling — it uses proper `bg-black bg-opacity-50` styling. Only the desktop version (line 2212-2549) has the debug overlay.

### NEW-2: Duplicate Field Status Form Code (app.js:1378-1712 and 2212-2549)
- **Severity**: INFO (code quality)
- **Impact**: The field status form is duplicated nearly identically — once for the Android layout (lines 1378-1712) and once for the desktop layout (lines 2212-2549). This is ~340 lines of duplicated JSX. The only differences are: (a) radio button `name` attributes (`uploadTypeAndroid` vs `uploadType`, `fieldWorkDoneAndroid` vs `fieldWorkDone`), and (b) the debug styling on the desktop version. This duplication means bugs fixed in one copy may not be fixed in the other.

### NEW-3: `express.json()` Called Redundantly on Some Routes
- **Severity**: INFO (code quality)
- **Impact**: `app.use(express.json())` is called globally at line 186, but then `express.json()` is also passed as middleware on individual routes like `/api/store-pending-field-status` (line 656) and `/api/log` (line 1642). This is harmless but indicates copy-paste without understanding middleware ordering.

### NEW-4: Synchronous `require('fs')` Inside Request Handler (server.js:1193-1194)
- **Severity**: LOW
- **Impact**: Inside the `/api/test-jxl` handler, `require('fs').existsSync()` is called synchronously. This blocks the event loop (briefly) and also loads the synchronous `fs` module at request time instead of at startup. Not a security issue, but poor practice in a test endpoint that could become a real endpoint.

### NEW-5: `spawn('python', ...)` in `/api/test-jxl` vs `spawn('python3', ...)` Elsewhere
- **Severity**: LOW (potential bug)
- **Impact**: The `/api/test-jxl` endpoint at line 1173 uses `spawn('python', ...)` while the `/api/generate-job-file` endpoint at line 1048 uses `spawn('python3', ...)`. In the Docker container (Debian-based node:18), `python` may not exist (only `python3`). This means the test endpoint may always fail while the production endpoint works.

### NEW-6: Unescaped `notifyComplete()` in FileDownloadManager.java (lines 192-199)
- **Severity**: MEDIUM
- **Impact**: Similar to the `notifyError()` XSS already documented, the `notifyComplete()` method also injects the `jobPath` string into JavaScript via `String.format`. While `jobPath` is typically user-controlled (from the portal UI), it only gets single-quote escaping via `replace("'", "\\'")`. If a job path contained characters like `\n` or backslash sequences, it could break the JS string context. Less exploitable than `notifyError()` since job paths are more constrained, but still a code injection vector.

### NEW-7: No Validation on `operator` Field Values
- **Severity**: LOW
- **Impact**: The frontend hardcodes operator values as `Allan`, `Joe`, `Nick` in dropdown selects (app.js:1432-1434, 2269-2272), but the server accepts any arbitrary string for the `operator` field in field status data. The field status JSON is written to disk and included in HiveMind notifications. If someone POSTs directly to the API, they can inject arbitrary content into the operator field.

### NEW-8: Template Path Traversal in `/api/create-job` (server.js:480)
- **Severity**: HIGH
- **Impact**: The `template` parameter from the request body is used in `path.join(CONFIG.TEMPLATES_DIR, template)` at line 480. If `template` is `../../etc/passwd`, the server will attempt to read files from outside the templates directory. Since the template files are then copied to the job directory, this could be used to exfiltrate arbitrary files by creating a job, then reading the copied files via the download endpoints.

---

## 4. MIGRATION & PATH CHANGE CONCERNS

### 4.1 Volume Relocation: `/volume1/Pardy Surveys/Data Sync/` to `/volume1/DataSync/`

**Critical considerations:**

1. **Docker-compose.yml must be updated** — All 5 volume mount paths reference the old location. The new paths need to strip the spaces:
   - Old: `/volume1/Pardy Surveys/Data Sync/trimble-sync:/app`
   - New: `/volume1/DataSync/trimble-sync:/app`
   - Same for office-jobs, controller-jobs, templates, notifications

2. **Rename `office-jobs` to `Data Sync`** — Per Nick's request. This changes the host path but NOT the container path. Inside the container, the mount point stays `/data/office`. Only `docker-compose.yml` changes.

3. **`process_pending_jobs.py` references old Z: paths** — Lines 18-19 reference `Z:\Data Sync\office-jobs`. These need updating to match the new location if this script runs on Windows.

4. **`windows_job_converter_service.py` references old Z: paths** — Lines 16-18 reference `Z:\Data Sync\trimble-sync\`. These need updating.

5. **`batch_convert_jxl.py` references old Windows paths** — Hardcoded paths in the batch converter.

6. **Synology Drive sync** — If Synology Drive is syncing the old `/volume1/Pardy Surveys/Data Sync/` folder, the sync target must be updated to `/volume1/DataSync/` or symlinked.

7. **HiveMind** — The HiveMind system reads from `/data/notifications/events.jsonl` inside the container. Since this is a volume mount, the notification path changes on the host side but NOT inside the container. HiveMind must be updated to watch `/volume1/DataSync/notifications/` instead of `/volume1/Pardy Surveys/Data Sync/notifications/`.

8. **Zero-downtime migration strategy:**
   - Keep old container running on old volumes
   - Copy data to new location
   - Start new container with new `docker-compose.yml` pointing to new volumes
   - Verify new container works
   - Stop old container
   - Do NOT delete old data until confirmed stable

### 4.2 `notifier.js` Hardcoded Path

The `notifier.js` writes to `/data/notifications/events.jsonl` which is a container-internal path. This path doesn't change during migration since it's the mount point, not the host path. No code change needed for notifier.

### 4.3 `logger.js` Path

`logger.js` writes to `sync-activity.log` in `__dirname` (the `/app` directory inside the container). Since `/app` is mounted from the `trimble-sync` folder, the log file location on the host changes from `/volume1/Pardy Surveys/Data Sync/trimble-sync/sync-activity.log` to `/volume1/DataSync/trimble-sync/sync-activity.log`.

---

## 5. COMPLETE IMPLEMENTATION PLAN (ALL 9 FEATURES)

### Feature 1: Authentication via nginx/Authelia

**Architecture:**
```
Internet → nginx (TLS, port 443)
         → Authelia (auth check)
         → Docker container (port 3000, server.js)
```

**Implementation steps:**
1. Create `auth/` directory with `authelia-config.yml` and `nginx.conf`
2. Add nginx and Authelia services to a new `docker-compose.auth.yml`
3. Configure Authelia with file-based users (mirroring Synology NAS accounts)
4. Set session lifetime to 1 year (`expiration: 31536000`)
5. Add `AUTH_ENABLED` feature flag to `config.js`
6. When `AUTH_ENABLED=true`, server.js middleware checks for `Remote-User` header (set by Authelia via nginx)
7. The Android WebView will automatically receive and persist cookies from Authelia's login page (WebView cookies persist across sessions since there's no `onDestroy`/`CookieManager` cleanup — confirmed in audit)
8. `FileDownloadManager.java` does NOT send cookies. Solution: when auth is enabled, server.js must allow a secondary auth method — check for `User-Agent: TrimbleSync/*` + `X-Client-Version` headers as a temporary bypass for native HTTP calls. This is an acceptable tradeoff since (a) the APK cannot be modified and (b) the native calls only hit `download-job` and `download-file` endpoints

**Feature flag:** `AUTH_ENABLED=false` (default)

**Test plan:**
- [ ] Verify Authelia login page renders on both desktop Chrome and Android WebView
- [ ] Verify 1-year session persistence on Android (close app, reopen next day)
- [ ] Verify native HTTP downloads still work from Android (User-Agent bypass)
- [ ] Verify all 24 endpoints still work with `AUTH_ENABLED=false`
- [ ] Verify CORS still works correctly with nginx as reverse proxy

### Feature 2: Recycle Bin for Delete Operations

**Implementation steps:**
1. Add `RECYCLE_BIN_ENABLED` flag to `config.js`
2. Create `recycleBin.js` module:
   - `moveToRecycleBin(sourcePath, metadata)` — moves to `/data/office/.recycle/{timestamp}_{originalName}/`
   - `restoreFromRecycleBin(recyclePath, originalPath)` — moves back
   - `listRecycleBin()` — lists all items with metadata
   - `purgeExpired(days=30)` — deletes items older than threshold
3. Modify `/api/delete` in server.js:
   - When `RECYCLE_BIN_ENABLED=true`: move to recycle bin instead of `fs.rm`
   - Write `_delete_metadata.json` alongside recycled item: `{deletedBy, deletedAt, originalPath, source (IP/User-Agent)}`
   - When `RECYCLE_BIN_ENABLED=false`: existing behavior (permanent delete)
4. Add auto-purge on server startup and every 24 hours via `setInterval`
5. Add API endpoints (feature-flagged):
   - `GET /api/recycle-bin` — list recycled items
   - `POST /api/recycle-bin/restore` — restore an item
   - `POST /api/recycle-bin/purge` — manual purge

**Feature flag:** `RECYCLE_BIN_ENABLED=false` (default)

**Test plan:**
- [ ] Delete a folder, verify it appears in `.recycle/` with metadata
- [ ] Delete individual files, verify same behavior
- [ ] Restore a recycled item, verify it goes back to original path
- [ ] Verify auto-purge removes items > 30 days old
- [ ] Verify with `RECYCLE_BIN_ENABLED=false`, deletes are still permanent
- [ ] Verify `.recycle/` folder is excluded from `buildFolderTree()` output

### Feature 3: Delete Logging

**Implementation steps:**
1. Add `deleteAction(folderOrFile, metadata)` method to `logger.js`
2. Call it from `/api/delete` handler in server.js, BEFORE the actual delete/recycle operation
3. Log format: `[timestamp] DELETE {folder|file} {path} by {IP} {User-Agent}`
4. This is independent of the recycle bin — logging happens regardless of `RECYCLE_BIN_ENABLED`

**Feature flag:** None needed — logging should always be active. This is a bug fix, not a feature.

**Test plan:**
- [ ] Delete a folder, verify entry in `sync-activity.log`
- [ ] Delete individual files, verify entries
- [ ] Verify log includes requester IP and User-Agent

### Feature 4: Volume Relocation

**Implementation steps:**
1. Document the exact `cp -a` commands for Nick to run on the NAS SSH
2. Create new `docker-compose.yml` with updated paths
3. Update Python scripts (`process_pending_jobs.py`, `windows_job_converter_service.py`, `batch_convert_jxl.py`) with new Z: drive paths
4. Nick manually copies data, starts new container, verifies, stops old container

**Feature flag:** None — this is infrastructure.

**Test plan:**
- [ ] All 24 endpoints respond correctly after migration
- [ ] File uploads land in correct new location
- [ ] Downloads serve files from correct new location
- [ ] HiveMind receives notifications from new path
- [ ] Synology Drive sync works with new path (if applicable)

### Feature 5: .job to .jxl Conversion

**Implementation steps:**
1. Add `JOB_TO_JXL_CONVERSION_ENABLED` flag to `config.js`
2. Create `jobConverter.js` module:
   - `convertJobToJxl(jobFilePath)` — spawns Wine with converter using `--command=job-to-jxl`
   - Returns path to generated `.jxl` file
   - Timeout protection (30 seconds)
3. In `/api/upload-field-data-android` handler (server.js:1285):
   - After files are saved and BEFORE the HiveMind notification
   - Find all `.job` files in the upload
   - For each `.job` file, run the converter
   - Save the resulting `.jxl` alongside the `.job` file
4. Wine converter command: `wine TrimbleAccess.JobConverter.ConverterProcess.exe --command=job-to-jxl --inPath={job} --outPath={jxl} --convertersPath={converterDir} --geodataPath={geodataDir}`

**Key finding from audit:** The converter executable supports BOTH directions. `batch_convert_jxl.py` uses `--command=jxl-to-job` (line 30). The reverse command `--command=job-to-jxl` should work based on the naming convention, but must be tested.

**Feature flag:** `JOB_TO_JXL_CONVERSION_ENABLED=false` (default)

**Test plan:**
- [ ] Upload a `.job` file, verify `.jxl` is generated alongside it
- [ ] Verify the generated `.jxl` is valid XML (parseable by xml2js)
- [ ] Verify conversion happens BEFORE notification fires
- [ ] Verify with flag disabled, no conversion occurs
- [ ] Test timeout behavior when Wine hangs
- [ ] Test with multiple `.job` files in single upload

### Feature 6: JXL Parsing to JSON for HiveMind

**Implementation steps:**
1. Add `JXL_PARSING_ENABLED` flag to `config.js`
2. Create `jxlParser.js` module:
   - `parseJxlToSummary(jxlFilePath)` — uses `xml2js` (already installed) to parse the JXL
   - Extracts: job name, coordinate system, point records, GNSS observations, stakeout records, evidence codes, feature codes
   - Returns structured JSON summary
3. In the upload handler, after `.job → .jxl` conversion:
   - Parse the `.jxl`
   - Include the JSON summary in the HiveMind notification payload
   - Save `jxl_summary.json` alongside the upload files

**JSON summary structure:**
```json
{
  "job_name": "26-001-260208",
  "coordinate_system": { "zone": "MTM Zone 1", "datum": "NAD83(CSRS)" },
  "point_count": 47,
  "points": [
    { "id": "100", "north": 5260123.456, "east": 304567.890, "elev": 12.345, "code": "FIP1" }
  ],
  "gnss_observations": 12,
  "stakeout_records": 5,
  "evidence_summary": {
    "found": ["100 - FIP1", "101 - FIB2"],
    "not_found": 1,
    "pins_placed": ["200 - CIP1"]
  }
}
```

**Feature flag:** `JXL_PARSING_ENABLED=false` (default)

**Test plan:**
- [ ] Parse a known `.jxl` file, verify JSON output matches expected structure
- [ ] Verify HiveMind notification includes parsed data
- [ ] Test with empty `.jxl` (no points)
- [ ] Test with corrupted `.jxl` (graceful failure)
- [ ] Verify with flag disabled, no parsing occurs

### Feature 7: Feature Flags

**Already partially implemented.** The existing `config.js` has:
- `UPLOAD_STREAMING_ENABLED`
- `UPLOAD_CHECKSUM_ENABLED`
- `UPLOAD_IDEMPOTENCY_ENABLED`
- `UPLOAD_PROGRESS_API`
- `HOST_REDIRECTS_ENABLED`
- `NOTIFICATIONS_ENABLED`

**New flags to add:**
- `AUTH_ENABLED`
- `RECYCLE_BIN_ENABLED`
- `JOB_TO_JXL_CONVERSION_ENABLED`
- `JXL_PARSING_ENABLED`
- `FORENSICS_LOGGING_ENABLED`
- `DELETE_LOGGING_ENABLED` (initially default to `true`)

**Implementation:** Extend `config.js` with these flags, each defaulting to `false` (except `DELETE_LOGGING_ENABLED` which defaults to `true` since it's a bug fix).

### Feature 8: Full Security Audit

**Covered by this report** (Sections 2 and 3). Implementation means applying fixes:

**Priority fixes (implement first):**
1. Add `validatePath()` calls to ALL 8+ endpoints missing them
2. Fix the off-by-one in `/api/download-file/*` — add `+ path.sep` to resolvedRoot
3. Escape HTML in OAuth callback responses
4. Add size cap to `pendingFieldStatus` Map (max 1000 entries)
5. Add depth limit to `buildFolderTree()` (max 10 levels)
6. Remove `process.env.PATH` from `/api/test-jxl` response
7. Sanitize `folderName` in Content-Disposition header
8. Remove the debug overlay from app.js desktop field status form
9. Fix the `spawn('python', ...)` vs `python3` inconsistency in `/api/test-jxl`

**Deferred fixes (require auth or APK change):**
- CORS null origin bypass — becomes irrelevant once auth is in place
- Android WebView debug mode — requires APK change (forbidden)
- Android file URL access — requires APK change (forbidden)
- `android:allowBackup="true"` — requires APK change (forbidden)

### Feature 9: Comprehensive Request Forensics/Fingerprinting

See Section 6 below for full design.

---

## 6. FORENSICS & FINGERPRINTING DESIGN

### 6.1 What Can Be Captured Server-Side (No Client Changes)

Every HTTP request already carries these headers. A middleware can extract:

| Data Point | Source | Always Available |
|------------|--------|:---:|
| Client IP | `req.ip` or `X-Forwarded-For` | Yes |
| Timestamp | `Date.now()` | Yes |
| HTTP Method + Path | `req.method`, `req.path` | Yes |
| Query Parameters | `req.query` | Yes |
| User-Agent | `req.get('User-Agent')` | Yes |
| Accept-Language | `req.get('Accept-Language')` | Yes |
| Accept-Encoding | `req.get('Accept-Encoding')` | Yes |
| Accept | `req.get('Accept')` | Yes |
| Referer | `req.get('Referer')` | Sometimes |
| Origin | `req.get('Origin')` | On CORS requests |
| Content-Type | `req.get('Content-Type')` | On POST |
| Content-Length | `req.get('Content-Length')` | On POST |
| Host | `req.get('Host')` | Yes |
| Connection | `req.get('Connection')` | Yes |
| Cookie | `req.get('Cookie')` | After auth setup |
| X-Forwarded-For | `req.get('X-Forwarded-For')` | Through proxy |
| X-Forwarded-Proto | `req.get('X-Forwarded-Proto')` | Through proxy |
| X-Forwarded-Host | `req.get('X-Forwarded-Host')` | Through proxy |
| X-Real-IP | `req.get('X-Real-IP')` | Through nginx |
| DNT | `req.get('DNT')` | Sometimes |
| Sec-Fetch-Mode | `req.get('Sec-Fetch-Mode')` | Modern browsers |
| Sec-Fetch-Site | `req.get('Sec-Fetch-Site')` | Modern browsers |
| Sec-Fetch-Dest | `req.get('Sec-Fetch-Dest')` | Modern browsers |
| Sec-CH-UA | `req.get('Sec-CH-UA')` | Chromium browsers |
| Sec-CH-UA-Mobile | `req.get('Sec-CH-UA-Mobile')` | Chromium browsers |
| Sec-CH-UA-Platform | `req.get('Sec-CH-UA-Platform')` | Chromium browsers |
| TLS version | From nginx via header or `req.protocol` | Through proxy |
| Request body size | `req.get('Content-Length')` | On POST |
| Response status | `res.statusCode` (via `res.on('finish')`) | Yes |
| Response time | `Date.now() - startTime` | Yes |
| ALL raw headers | `req.rawHeaders` (array of key-value pairs) | Yes |

### 6.2 What Can Be Captured Client-Side (JavaScript in Browser/WebView)

These require a small JavaScript snippet to run in the browser and POST back to a logging endpoint:

| Data Point | API | Notes |
|------------|-----|-------|
| Screen resolution | `screen.width`, `screen.height` | |
| Viewport size | `window.innerWidth`, `window.innerHeight` | |
| Device pixel ratio | `window.devicePixelRatio` | |
| Timezone offset | `new Date().getTimezoneOffset()` | |
| Timezone name | `Intl.DateTimeFormat().resolvedOptions().timeZone` | |
| Language | `navigator.language`, `navigator.languages` | |
| Platform | `navigator.platform` | Deprecated but still available |
| Hardware concurrency | `navigator.hardwareConcurrency` | CPU cores |
| Device memory | `navigator.deviceMemory` | RAM in GB (Chrome) |
| Max touch points | `navigator.maxTouchPoints` | |
| Online status | `navigator.onLine` | |
| Cookie enabled | `navigator.cookieEnabled` | |
| Do Not Track | `navigator.doNotTrack` | |
| PDF viewer | `navigator.pdfViewerEnabled` | |
| WebGL renderer | WebGL context `getParameter(RENDERER)` | GPU identification |
| WebGL vendor | WebGL context `getParameter(VENDOR)` | |
| Canvas fingerprint | Hash of canvas rendering output | Unique per device |
| AudioContext fingerprint | Hash of audio processing output | Unique per device |
| Installed fonts (partial) | Canvas font rendering measurement | Limited set detectable |
| Battery status | `navigator.getBattery()` | Deprecated, limited |
| Connection type | `navigator.connection.effectiveType` | Mobile networks |
| Connection downlink | `navigator.connection.downlink` | Bandwidth estimate |
| WebRTC local IP | ICE candidate gathering | Local/private IP (if not blocked) |
| Geolocation | `navigator.geolocation.getCurrentPosition()` | **NOT available** — see 6.3 |

### 6.3 Geolocation Limitation

As documented in Section 1.3, the Android WebView does NOT have geolocation enabled (no `onGeolocationPermissionsShowPrompt` override). The `navigator.geolocation` API will fail silently or throw a permission error in the WebView.

On desktop browsers, geolocation requires user consent via browser prompt. It should NOT be auto-requested — only requested when the user explicitly grants permission.

**Alternative for location data:** IP-based geolocation using the `X-Forwarded-For` or `X-Real-IP` header. This gives city-level accuracy without any client-side permissions.

### 6.4 Implementation Design

1. **Server-side middleware** (`forensicsLogger.js`):
   - Runs on every request when `FORENSICS_LOGGING_ENABLED=true`
   - Captures all server-side data points from Section 6.1
   - Writes to `request-forensics.jsonl` (append-only, one JSON object per line)
   - Includes response status and timing via `res.on('finish', ...)`

2. **Client-side fingerprint collector** (embedded in `index.html` or `app.js`):
   - On first page load, gathers all client-side data from Section 6.2
   - POSTs to `/api/fingerprint` (new endpoint)
   - Stores a fingerprint hash in `localStorage` to avoid re-sending on every page load
   - Re-sends if any data changes (e.g., screen resize, new browser)

3. **Storage format** (JSONL):
```json
{
  "ts": "2026-02-08T14:30:00.000Z",
  "type": "request",
  "ip": "192.168.1.100",
  "xff": "203.0.113.50",
  "method": "POST",
  "path": "/api/upload-field-data-android",
  "status": 200,
  "duration_ms": 1250,
  "ua": "TrimbleSync/1.0.1",
  "headers": { "...all raw headers..." },
  "body_size": 15728640
}
```

4. **Rotation**: Rotate log files daily or at 100MB, keep 90 days.

**Feature flag:** `FORENSICS_LOGGING_ENABLED=false` (default)

---

## 7. JXL CONVERSION DESIGN

### 7.1 Conversion Pipeline

```
Upload arrives (POST /api/upload-field-data-android)
  │
  ├─ Files saved to /data/office/{jobPath}/Field_Data/{timestamp}/
  │
  ├─ [IF JOB_TO_JXL_CONVERSION_ENABLED]
  │   ├─ Find all .job files in the upload folder
  │   ├─ For each .job:
  │   │   ├─ wine TrimbleAccess.JobConverter.ConverterProcess.exe
  │   │   │   --command=job-to-jxl
  │   │   │   --inPath={job_file}
  │   │   │   --outPath={job_file.replace('.job', '.jxl')}
  │   │   │   --convertersPath={converterDir}
  │   │   │   --geodataPath={geodataDir}
  │   │   ├─ Timeout: 30 seconds
  │   │   ├─ On success: .jxl file appears alongside .job
  │   │   └─ On failure: log error, continue (don't fail the upload)
  │   │
  │   └─ [IF JXL_PARSING_ENABLED]
  │       ├─ Parse each generated .jxl with xml2js
  │       ├─ Extract structured data (points, codes, GNSS, etc.)
  │       ├─ Save jxl_summary.json in upload folder
  │       └─ Include summary in HiveMind notification payload
  │
  ├─ Create field_status.json
  │
  └─ Queue HiveMind notification (with optional jxl_summary)
```

### 7.2 Converter Command Verification

The existing codebase uses the converter in ONE direction only:
- `server.js:1089` — `--command=jxl-to-job` (JXL → JOB)
- `batch_convert_jxl.py:30` — `--command=jxl-to-job` (JXL → JOB)

The reverse direction (`--command=job-to-jxl`) has never been tested in this codebase. **This must be verified before implementation by:**
1. SSH into the NAS
2. Run: `docker exec -it <container> wine /app/trimble-converter/JobConversion/TrimbleAccess.JobConverter.ConverterProcess.exe --help`
3. Check if `job-to-jxl` is listed as a valid command
4. If yes, test with a known `.job` file

### 7.3 JXL XML Structure (for Parsing)

Based on `jxl_generator.py`, a JXL file has this structure:
```xml
<JOBFile jobName="..." version="6.32" product="Trimble Access">
  <FieldBook>
    <UnitsRecord>...</UnitsRecord>
    <EllipsoidRecord>...</EllipsoidRecord>
    <ProjectionRecord>...</ProjectionRecord>
    <DatumRecord>...</DatumRecord>
    <CoordinateSystemRecord>...</CoordinateSystemRecord>
    <FeatureCodingRecord>...</FeatureCodingRecord>
    <CorrectionsRecord>...</CorrectionsRecord>
    <LinkedFilesRecord>...</LinkedFilesRecord>
    <ActiveMapFilesRecord>...</ActiveMapFilesRecord>
    <JobPropertiesRecord>...</JobPropertiesRecord>
    <TimeZoneRecord>...</TimeZoneRecord>
    <!-- Point observations, GNSS, stakeouts go here in field-collected JXLs -->
  </FieldBook>
  <Reductions/>
  <Environment>
    <DisplaySettings>...</DisplaySettings>
    <CoordinateSystem>...</CoordinateSystem>
    <JobProperties>...</JobProperties>
  </Environment>
</JOBFile>
```

For field-collected JXLs (converted from .job), the `<FieldBook>` section will also contain:
- `<PointRecord>` — Individual survey points with coordinates
- `<GpsPointRecord>` — GNSS observations
- `<StakeoutRecord>` — Stakeout/layout records
- Various other observation types

The parser should extract all of these into the JSON summary.

---

## 8. FILE INVENTORY VERIFICATION

### Files confirmed present in repository:

**Server-side (trimble-sync/):**
- `server.js` — 1801 lines
- `config.js` — 55 lines
- `docker-compose.yml` — 48 lines
- `Dockerfile` — 71 lines (assessment said 70 — off by 1)
- `notifier.js` — 51 lines
- `logger.js` — 96 lines
- `uploadHandler.js` — 104 lines
- `idempotencyStore.js` — 154 lines
- `progressStore.js` — 131 lines
- `checksumUtil.js` — 78 lines
- `package.json` — 23 lines
- `public/app.js` — **2555 lines** (assessment said ~1300)
- `public/index.html` — 150 lines
- `public/upload-status.html` — 385 lines (assessment said 385, but actual is 386 — 385 lines of code + final newline)

**Converter (trimble-sync/trimble-converter/):**
- `jxl_generator.py` — 746 lines (assessment said 745)
- `batch_convert_jxl.py` — 95 lines

**Other Python scripts:**
- `process_pending_jobs.py` — 150 lines
- `windows_job_converter_service.py` — 90 lines

**Android App:**
- `MainActivity.java` — 1032 lines
- `FileDownloadManager.java` — 222 lines
- `BuildConfig.java` — 12 lines
- `AndroidManifest.xml` — 41 lines

**Chat History:**
- `Combined Assessment - All Sessions - 260208.md` — 1044 lines

---

## SUMMARY FOR NICK

Nick, here's the bottom line:

1. **The Combined Assessment is ~90% accurate.** The major claims about security vulnerabilities are all confirmed. However, it fabricated 2 endpoints that don't exist (`/api/rename` and `/api/job-info/*`) and significantly understated the size of `app.js` (2555 lines, not 1300).

2. **I found 8 additional issues** not in the original assessment, including debug code left in production, a template path traversal vulnerability, and XSS in `FileDownloadManager.notifyComplete()`.

3. **The most critical action is authentication.** Every endpoint is wide open. The delete endpoint with `recursive:true, force:true` and no path validation is essentially a remote "delete anything" button.

4. **The migration is straightforward** but requires careful orchestration. Keep the old container running until the new one is confirmed.

5. **The .job → .jxl conversion command needs to be verified** — the converter has only been used in the JXL→JOB direction so far.

6. **All 9 features can be implemented purely additively with feature flags**, as requested. The Android APK does not need to be touched.

Awaiting your approval to proceed to Phase D (implementation).
