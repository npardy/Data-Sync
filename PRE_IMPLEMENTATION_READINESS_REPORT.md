# Pre-Implementation Readiness Report

**Date**: 2026-02-08
**System**: Pardy Surveys Data Sync
**Environment**: Synology NAS / Docker (node:18 + Wine + Python3 + .NET 4.7.2)
**Scope**: Final check before implementation of 9 planned features

---

## Summary

This report covers six investigation areas. Of the items checked, **3 are blockers** that must be resolved before implementation begins, **7 need attention**, and **5 are confirmed ready**. Several discoveries contradict assumptions made by previous audit instances.

---

## 1. Wine Converter: Does `job-to-jxl` Actually Work?

### Status: Partially a blocker, partially moot

**Finding**: The `--command=job-to-jxl` reverse direction has **never been tested** in the Docker/Wine environment. Every reference to it in the codebase is speculative -- all 30+ mentions of `job-to-jxl` appear exclusively in chat history and assessment documents, never in production code or test scripts.

**What exists**:
- `batch_convert_jxl.py` line 30: uses only `--command=jxl-to-job`
- `server.js` line 1091: uses only `--command=jxl-to-job`
- `test_converter.sh` line 32: tests only `jxl-to-job`
- `test_wine_converter.sh` line 29: tests only `jxl-to-job`

**What doesn't exist**:
- Zero test scripts for the reverse direction
- No `--help` output captured from the converter
- No Trimble documentation in the repo confirming supported commands
- The `NDesk.Options.dll` command-line parser doesn't self-document externally

### Discovery: The reverse conversion may be unnecessary

Examining actual field data uploads reveals the controller sends:
- `.job` (binary Trimble format, ~115KB with observations)
- `.csv` (point data with coordinates and feature codes)
- `.dxf` (CAD drawing)
- Layout CSVs, photos

**No `.jxl` files are uploaded from the field.** The system already parses the `.csv` for feature codes (FIP, CIP, PNF, etc.) via `parseCSVForFeatureCodes()` at `server.js:40-109`. This CSV parsing is the primary mechanism for extracting field observations and it works -- the events.jsonl data proves it with real parsed results from actual surveys.

**The question previous instances should have asked**: What additional data would `job-to-jxl` conversion provide that the CSV doesn't already contain? The CSV has point IDs, coordinates, and feature codes. If that's sufficient for HiveMind notifications, the reverse conversion is unnecessary overhead.

### Recommendation

Before investing in `job-to-jxl`:
1. Run `wine TrimbleAccess.JobConverter.ConverterProcess.exe --help` in the Docker container to confirm supported commands
2. Define what data Phase 4 actually needs that the CSV doesn't provide
3. If raw coordinate/observation data beyond CSV is needed, *then* test `job-to-jxl`

---

## 2. Feb 7 Mass Deletion Analysis

### Status: Forensic analysis complete, root cause unrecoverable

**Timeline**: 18 `job_deleted` events between 10:13:12 UTC and 10:14:20 UTC (68 seconds)

**Deletion sequence with intervals**:

| # | Time | Folder | Interval |
|---|------|--------|----------|
| 1 | 10:13:12.271 | 26-000-050 | -- |
| 2 | 10:13:16.025 | 26-000-050 | 3.75s |
| 3 | 10:13:24.651 | 25-200-250 | 8.63s |
| 4 | 10:13:38.901 | 25-150-200 | 14.25s |
| 5 | 10:13:44.247 | 25-100-150 | 5.35s |
| 6 | 10:13:48.163 | 25-050-100 | 3.92s |
| 7 | 10:13:50.313 | 25-050-100 | 2.15s |
| 8 | 10:13:52.269 | 25-000-050 | 1.96s |
| 9 | 10:13:54.250 | 25-000-050 | 1.98s |
| 10 | 10:13:56.320 | 24-200-300 | 2.07s |
| 11 | 10:13:58.351 | 24-200-300 | 2.03s |
| 12 | 10:14:00.297 | 24-100-200 | 1.95s |
| 13 | 10:14:02.259 | 24-100-200 | 1.96s |
| 14 | 10:14:09.903 | 24-000-100 | 7.64s |
| 15 | 10:14:11.849 | 24-000-100 | 1.95s |
| 16 | 10:14:15.274 | 23-000-400 | 3.43s |
| 17 | 10:14:17.883 | 22-000-400 | 2.61s |
| 18 | 10:14:20.549 | 21-000-22-000 | 2.67s |

**Pattern analysis**:

- **Duplicate folder pairs**: 7 folders were deleted twice (26-000-050, 25-050-100, 25-000-050, 24-200-300, 24-100-200, 24-000-100). This is consistent with the web UI behavior -- the delete button triggers on the top-level folder, and if subfolders had separate entries, each triggers a separate `/api/delete` call.
- **Timing**: The early deletions (events 1-5) have irregular intervals (3.75s to 14.25s), consistent with a human navigating a UI and confirming deletions. The middle sequence (events 7-13) shows remarkably consistent ~2-second intervals, which could be a human in a rhythm or a slow script.
- **Order**: Folders were deleted in descending job number order (26-xxx, 25-xxx, 24-xxx, 23-xxx, 22-xxx, 21-xxx). This matches scrolling down through the web UI's folder list.
- **Scope**: Every top-level range folder was deleted. This was a complete cleanup/reset of all office jobs.

**What the logs don't tell us**:

- `sync-activity.log` only records controller (Android) requests, not web UI requests
- No IP address, user agent, or session ID was logged with deletion requests
- The `/api/delete` endpoint has zero authentication and zero request logging
- Docker container `console.log('Delete request:', req.body)` would have shown the raw requests, but container logs don't survive restarts and aren't persisted to a file

**Assessment**: Most likely a human using the web UI, possibly intentionally clearing old data to prepare for the NAS migration. The descending order and UI-consistent timing patterns support this. However, without IP/user logging, this cannot be confirmed.

---

## 3. NAS Directory Structure

### Status: Partially verifiable from the repo

**What the docker-compose.yml declares**:

```yaml
volumes:
  - /volume1/Pardy Surveys/Data Sync/trimble-sync:/app
  - /volume1/Pardy Surveys/Data Sync/office-jobs:/data/office
  - /volume1/Pardy Surveys/Data Sync/controller-jobs:/data/controller
  - /volume1/Pardy Surveys/Data Sync/templates:/data/templates
  - /volume1/Pardy Surveys/Data Sync/notifications:/data/notifications
```

**What exists in the repo** (matching the mounted data):

| Mount | Repo Equivalent | Status |
|-------|----------------|--------|
| `/data/office` | `Data Sync/` dir | Has 26-000-050 folder with 11 active jobs |
| `/data/controller` | `controller-jobs/` | Has test data (job 1000, 25-100, etc.) |
| `/data/templates` | `templates/` | Has Zone 1 template with TMNT Z1.jxl + control CSV |
| `/data/notifications` | `notifications/` | Has events.jsonl (44 events) |
| `/app` | `trimble-sync/` | Full application code |

**Current live data survived the Feb 7 deletion**: Only `26-000-050` remains in office-jobs (all 2021-2025 range folders were deleted). This folder contains 11 active jobs with field data uploads dating from Jan 14 - Feb 6, 2026.

### Concerning findings

- **No reference to D: drive or Z: drive in any code or config**. The prompt mentions these paths, but the actual system uses Synology `/volume1/` paths exclusively. Either the D:/Z: drive migration hasn't started, or it was already completed and the old references were removed.
- **No backup/snapshot configuration visible** in docker-compose.yml or anywhere in the repo.
- **Single volume**: All data lives on `/volume1/`. No RAID configuration is visible from the application layer.

---

## 4. Reverse Proxy / SSL / Auth Infrastructure

### Status: Synology built-in proxy is in use, no Authelia exists

**Current architecture**:

```
Internet
  |
  v
pardysurveys.synology.me (Synology DDNS)
  |
  v
Synology DSM Reverse Proxy (HTTPS termination)
  |  Control Panel > Application Portal > Reverse Proxy
  |  Source: HTTPS *.quickconnect.to
  |  Destination: HTTP localhost:3000
  v
Docker container (trimble-sync:3000, plain HTTP)
```

**What exists**:
- Synology DDNS at `pardysurveys.synology.me`
- Legacy QuickConnect at `pardysurveys.direct.quickconnect.to`
- Synology reverse proxy handling SSL termination
- CORS configured for `*.synology.me`, `*.myds.me`, `*.direct.quickconnect.to`, plus LAN ranges
- Host redirect middleware (currently disabled) for legacy-to-new URL migration
- Android app hardcoded to `https://pardysurveys.synology.me/`

**What does NOT exist**:
- No nginx configuration (no nginx.conf anywhere in repo)
- No Authelia installation or configuration
- No authentication of any kind on any endpoint
- No Let's Encrypt configuration in the app (Synology may handle this separately)

### Implication for implementation

The plan to add nginx + Authelia means:
- Port 443 may already be in use by Synology DSM's own web interface
- The Synology reverse proxy would need to be reconfigured or replaced
- nginx would need to sit between Synology's proxy and the container, OR replace it entirely
- The Android app's hardcoded URL would need updating if the proxy architecture changes

---

## 5. Docker Environment Health

### Status: Functional but missing operational hardening

**Configuration review**:

| Aspect | Status | Detail |
|--------|--------|--------|
| Container restart | OK | `restart: unless-stopped` |
| Wine + .NET 4.7.2 | OK | Installed via Dockerfile with fallbacks |
| Node.js 18 | OK | LTS version |
| Graceful shutdown | OK | SIGTERM/SIGINT handlers with 15s timeout |
| Upload streaming | OK | Enabled, disk-based (not RAM) |
| Checksums | OK | MD5 verification enabled |
| Progress store cleanup | OK | TTL 1hr, cleanup every 10min |
| Idempotency store cleanup | OK | TTL 1hr, cleanup every 10min, persisted to JSON |
| Docker healthcheck | MISSING | No `healthcheck:` in docker-compose.yml |
| Container resource limits | MISSING | No mem_limit, no CPU limit |
| Log rotation | MISSING | sync-activity.log grows unbounded |
| events.jsonl rotation | MISSING | Notification queue grows unbounded |
| .uploads-partial cleanup | MISSING | Directory defined but never cleaned |
| Concurrent upload limits | MISSING | No rate limiting or connection caps |

### Unbounded growth risks

Three files will grow without limit:
1. **`sync-activity.log`** -- appended to on every controller API call, never rotated
2. **`events.jsonl`** -- appended to on every job create/delete/upload, never rotated or consumed
3. **`/data/office/.uploads-partial/`** -- partial upload remnants never cleaned (`UPLOAD_PARTIAL_RETENTION_HOURS` is defined in config.js but **never used in any cleanup logic**)

---

## 6. Anything Else That Would Block Implementation

### Path traversal in `/api/delete` (server.js:360-400)

The `validatePath()` function exists at `server.js:272-281` and is used by `/api/upload` (line 599), `/api/download-file` (line 716), and `/api/upload-field-data-android` (line 1321). But `/api/delete` does NOT use it:

```javascript
// server.js:367 -- NO validatePath() call
const folderPath = path.join(CONFIG.OFFICE_ROOT, folder);
await fs.rm(folderPath, { recursive: true, force: true });
```

A request with `folder: "../../etc"` would escape the root directory. Same issue in `/api/create-main-folder` (line 410).

### Wine converter error handling gap (server.js:1119-1121)

```javascript
converter.on('error', (error) => {
  console.error('Failed to start converter:', error);
  // NO response sent to client -- request hangs forever
});
```

If Wine fails to start (binary missing, permission denied, etc.), the HTTP request hangs indefinitely. No timeout, no error response.

### Duplicate notification events

The `job_deleted` notification regex at `server.js:371` matches top-level range folders:
```javascript
const jobMatch = folder.match(/(\d{2}-\d{3})\s*-\s*(.+)$/);
```

For the folder `26-000-050`, this extracts `job_number: "26-000"`, `job_name: "050"`. But `26-000` is not a real job number -- it's a range folder. The Feb 7 deletions show this: all 18 "deleted job" events have range-folder numbers (26-000, 25-200, 25-150, etc.), not actual job numbers. The notification system is logging misleading data.

### Hardcoded controller serial in JXL generator

`jxl_generator.py:42-45`:
```python
CONTROLLER_SERIAL = "JAJ215020019"
PRODUCT_VERSION = "25.10"
```

If Pardy Surveys has multiple controllers or upgrades Trimble Access, these hardcoded values would produce JXL files that don't match the actual hardware. This should be configurable.

### Android app SDK range

`build.gradle`: `compileSdk 36`, `minSdk 23`. Android 5.1 (API 23) is from 2015. If no one is using a device that old, raising `minSdk` to 26+ would allow removing legacy permission handling code and enable modern features.

---

## Findings Summary

### BLOCKERS

**B1. Path traversal vulnerability in `/api/delete` and `/api/create-main-folder`**
These endpoints accept user-supplied paths without calling `validatePath()`. An attacker on the LAN (or anyone with the DDNS URL) can delete or create arbitrary directories on the NAS. `validatePath()` already exists and is used by other endpoints -- it just needs to be added here. This is a one-line fix per endpoint but it **must** be done before any implementation work that adds more endpoints or exposes the system to wider access.

**B2. No authentication on any endpoint**
Every API endpoint is completely open. The system relies on network isolation ("internal network use only" per documentation), but it's accessible via `pardysurveys.synology.me` from the public internet. The Feb 7 mass deletion demonstrates the real-world consequence: any user or script with network access can destroy all data. Adding nginx + Authelia (as planned) is correct, but it must be the **first** implementation, not one of nine features.

**B3. Wine converter error handling leaves requests hanging**
If Wine fails to start (line 1119-1121), no HTTP response is ever sent. The client waits until the 10-minute server timeout. This needs a response path for the error case, and ideally a converter health check at startup.

### NEEDS ATTENTION

**A1. `--command=job-to-jxl` is untested but may be unnecessary**
Field data already comes with CSV files containing point data. The existing CSV parser extracts the exact data that HiveMind notifications use. Define what additional data the reverse conversion would provide before investing in testing it.

**A2. Feb 7 deletion source is unrecoverable**
No IP logging, no user agent logging, no authentication trail. Add request logging to `/api/delete` immediately so future incidents can be traced.

**A3. No log rotation for sync-activity.log, events.jsonl**
Both files will grow indefinitely. On a NAS with limited storage, this will eventually cause problems.

**A4. `.uploads-partial` directory never cleaned**
`UPLOAD_PARTIAL_RETENTION_HOURS` config exists but has no implementation. Partial uploads accumulate forever.

**A5. No Docker healthcheck**
Synology can't monitor container health without a `healthcheck:` directive.

**A6. No container resource limits**
A runaway Wine process or memory leak can consume all NAS resources.

**A7. `job_deleted` notifications log range-folder numbers, not actual job numbers**
The regex at `server.js:371` matches `26-000-050` as job `26-000`. Downstream consumers (HiveMind) would receive misleading data about which "jobs" were deleted.

### READY

**R1. Volume mounts and directory structure**: Correctly configured in docker-compose.yml. All five mount points have corresponding data.

**R2. Forward JXL-to-JOB conversion**: Proven working. Production test data confirms successful .job file generation from JXL templates.

**R3. Field data upload pipeline**: Fully operational. CSV extraction, field status tracking, and notification queueing all work with real survey data (verified across 26 upload events from Jan-Feb 2026).

**R4. Synology reverse proxy with HTTPS**: Already configured and working. Android app connects via `https://pardysurveys.synology.me/`.

**R5. Template system**: Zone 1 template with reference JXL and control CSV is in place. Job creation pipeline uses this successfully.

### DISCOVERIES

**D1. The CSV already contains the field observation data**
Previous instances assumed `job-to-jxl` conversion was needed for Phase 4 field data parsing. But real field uploads already include a `.csv` with all point data (coordinates + feature codes). The server already parses this. The 26 `field_data_uploaded` events in events.jsonl prove this works with real surveys, including evidence counts, monument checks, and pin placements. The `job-to-jxl` conversion may be solving a problem that doesn't exist.

**D2. Duplicate deletion events reveal the notification regex is wrong**
7 of 18 deletion events are duplicates for the same folder. The regex `(\d{2}-\d{3})\s*-\s*(.+)$` matches range folders (like `26-000-050`) as if they were jobs. When a range folder is deleted, the notification says "job 26-000 deleted" which is meaningless. When actual jobs inside were deleted, no individual notifications were generated because `fs.rm` with `recursive: true` deletes the tree without notifying per-subfolder.

**D3. The system has been in active production use since at least Jan 2026**
Events show real surveys by operators "Allan" and "Joe" across jobs 22-066 through 26-014, with genuine field data (6-hour field days, 2-hour travel times, 100+ point surveys, battery charging issues noted). This is not a test system. Implementation changes carry production risk.

**D4. Controller jobs retain test data from Aug 2025**
The `controller-jobs/` directory contains folders dated `250808` with test addresses like "rweg". These should be cleaned up before or during implementation.

---

## Recommended Implementation Order

Based on these findings, the planned 9 features should be reordered:

1. **Authentication (nginx + Authelia)** -- Must be first. The system is internet-accessible with zero auth.
2. **Path traversal fixes** -- Add `validatePath()` to `/api/delete` and `/api/create-main-folder`. One-line fix each.
3. **Request logging for destructive operations** -- Log IP, user agent, timestamp for delete/create operations.
4. **Wine converter error handling** -- Add response path for converter.on('error').
5. **Log rotation and cleanup** -- For sync-activity.log, events.jsonl, and .uploads-partial.
6. **Docker healthcheck and resource limits** -- Add to docker-compose.yml.
7. **Then proceed with feature work** -- The remaining planned features can proceed once the above are addressed.

Do NOT start feature implementation while the system is internet-accessible with no authentication and a path traversal vulnerability in the delete endpoint.
