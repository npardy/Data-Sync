# TRIMBLE SYNC: SERVER-ONLY UPLOAD RESILIENCE PATCH

**Implementation Complete** | **Version:** 1.0.0 | **Date:** 2025-10-15

---

## 📋 Executive Summary

This patch implements server-side upload resilience improvements for the Trimble Sync system to handle low-bandwidth conditions (1 Mbps upstream, 500ms RTT). **All changes are feature-flagged** and default to `false` to prevent regression.

**Key Improvements:**
- 🔄 **Disk streaming** replaces RAM buffering (prevents OOM)
- 📊 **Progress API** provides real-time upload visibility
- ✅ **Checksums** verify upload integrity
- 🔁 **Idempotency** prevents duplicate processing
- ⏱️ **Extended timeouts** support slow links
- 📝 **Enhanced logging** tracks every upload phase

**Hard Constraint:** Android client has a 120-second write timeout, limiting reliable uploads to ~15 MB at 1 Mbps. This patch cannot override client-side timeouts but maximizes success for files within this limit.

---

## 1️⃣  Code Diffs & New Files

### NEW FILES CREATED

#### `trimble-sync/config.js`
Feature flags module. All defaults are `false`.

```javascript
module.exports = {
  UPLOAD_STREAMING_ENABLED: process.env.UPLOAD_STREAMING_ENABLED === 'true',
  UPLOAD_STREAM_HIGHWATER: parseInt(process.env.UPLOAD_STREAM_HIGHWATER) || 65536,
  UPLOAD_CHECKSUM_ENABLED: process.env.UPLOAD_CHECKSUM_ENABLED === 'true',
  UPLOAD_IDEMPOTENCY_ENABLED: process.env.UPLOAD_IDEMPOTENCY_ENABLED === 'true',
  UPLOAD_RESUME_ENABLED: process.env.UPLOAD_RESUME_ENABLED === 'true',
  UPLOAD_PARTIAL_RETENTION_HOURS: parseInt(process.env.UPLOAD_PARTIAL_RETENTION_HOURS) || 24,
  SERVER_TIMEOUT_MS: parseInt(process.env.SERVER_TIMEOUT_MS) || 120000,
  SERVER_KEEPALIVE_MS: parseInt(process.env.SERVER_KEEPALIVE_MS) || 65000,
  UPLOAD_PROGRESS_API: process.env.UPLOAD_PROGRESS_API === 'true',
  UPLOAD_PROGRESS_INTERVAL_BYTES: parseInt(process.env.UPLOAD_PROGRESS_INTERVAL_BYTES) || 1048576,
  UPLOAD_TEMP_DIR: process.env.UPLOAD_TEMP_DIR || '/tmp/uploads',
  UPLOAD_PARTIAL_DIR: process.env.UPLOAD_PARTIAL_DIR || '/tmp/uploads-partial'
};
```

#### `trimble-sync/uploadHandler.js`
Multer disk storage handler with streaming support.

**Key function:** `getUpload()` returns streaming or memory upload based on flag.

#### `trimble-sync/progressStore.js`
In-memory progress tracking with TTL cleanup.

**API:** `updateProgress()`, `getProgress()`, `listActive()`, `markCompleted()`, `markFailed()`

#### `trimble-sync/checksumUtil.js`
MD5 checksum computation (streaming, memory-efficient).

**API:** `computeChecksum(filePath)`, `computeChecksums(files)`, `verifyChecksum()`

#### `trimble-sync/idempotencyStore.js`
Duplicate upload detection with JSON persistence.

**API:** `checkDuplicate(jobPath, files)`, `storeResult(jobPath, files, result)`

#### `trimble-sync/public/upload-status.html`
Real-time upload monitoring dashboard. Auto-refreshes every 3 seconds.

**Access:** `http://192.168.1.41:3000/upload-status.html`

#### `trimble-sync/tools/upload-smoke.js`
Node.js smoke test script. Tests 2MB, 10MB, and multi-file uploads.

**Run:** `node tools/upload-smoke.js`

#### `trimble-sync/tools/slowlink_smoke.sh`
Linux integration test with traffic shaping (tc). Requires root.

**Run:** `sudo ./tools/slowlink_smoke.sh eth0`

---

### MODIFIED FILES

#### `trimble-sync/logger.js`
Added methods:
- `uploadStarted(jobPath, fileCount, uploadId)`
- `uploadFileCompleted(filename, size, uploadId)`
- `uploadCompleted(jobPath, fileCount, totalBytes, durationMs, uploadId)`
- Enhanced `uploadFailed()` with uploadId parameter

#### `trimble-sync/server.js`
**Changes:**
1. **Imports** (lines 1-17): Added config, uploadHandler, progressStore, checksumUtil, idempotencyStore
2. **Multer instances** (lines 56-61): Now call `getUpload()` to toggle streaming
3. **Upload endpoints**: All 3 endpoints updated:
   - `/api/upload` (lines 266-306)
   - `/api/upload-field-data` (lines 308-375)
   - `/api/upload-field-data-android` (lines 883-1053) ← **CRITICAL**
4. **Progress API routes** (lines 1136-1171):
   - `GET /api/upload-status/:uploadId`
   - `GET /api/upload-status`
5. **Server timeouts** (lines 1177-1197):
   - `server.timeout`, `server.keepAliveTimeout`, `server.headersTimeout`

**Endpoint enhancements (android upload):**
- Idempotency check before processing
- Progress store updates
- Streaming vs buffer toggle
- Checksum computation (if enabled)
- Enhanced logging with uploadId
- Atomic temp file cleanup

#### `trimble-sync/docker-compose.yml`
Added environment variables (all default `false`):

```yaml
environment:
  - NODE_ENV=production
  - TZ=America/St_Johns
  - WINEDEBUG=-all
  - DISPLAY=:0
  # Upload resilience flags
  - UPLOAD_STREAMING_ENABLED=false
  - UPLOAD_PROGRESS_API=false
  - UPLOAD_CHECKSUM_ENABLED=false
  - UPLOAD_IDEMPOTENCY_ENABLED=false
  - UPLOAD_RESUME_ENABLED=false
  # Server timeouts
  - SERVER_TIMEOUT_MS=120000
  - SERVER_KEEPALIVE_MS=65000
  # Paths
  - UPLOAD_TEMP_DIR=/tmp/uploads
  - UPLOAD_PARTIAL_DIR=/tmp/uploads-partial
```

---

## 2️⃣  Docker & Environment

### Build and Deploy Commands

```bash
# Navigate to project directory
cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"

# Stop existing container
sudo docker-compose down

# Build with no cache (to pick up new files)
sudo docker-compose build --no-cache

# Start container in detached mode
sudo docker-compose up -d

# View logs (follow mode)
sudo docker-compose logs -f trimble-sync

# Check container status
sudo docker ps | grep trimble-sync
```

### Verify Deployment

```bash
# Check health endpoint
curl http://192.168.1.41:3000/health

# Check upload config (should show all flags as false initially)
sudo docker-compose logs trimble-sync | grep "Upload resilience config"

# Expected output:
# Upload resilience config: {
#   streaming: false,
#   progressAPI: false,
#   checksums: false,
#   idempotency: false,
#   timeout: '120000ms',
#   keepalive: '65000ms'
# }
```

---

## 3️⃣  Operator Runbook (Synology DSM)

### Manual Reverse Proxy Tuning

**⚠️ IMPORTANT:** These settings cannot be configured from Docker. You must manually update Synology DSM.

**Location:** DSM → Control Panel → Application Portal → Reverse Proxy

**Steps:**

1. **Navigate to Reverse Proxy Settings**
   - Log in to Synology DSM web interface
   - Go to **Control Panel**
   - Select **Application Portal** (or **Application** on older DSM)
   - Click **Reverse Proxy** tab

2. **Find Existing Rule**
   - Look for rule with:
     - **Source:** `pardysurveys.direct.quickconnect.to:3000` (or external domain)
     - **Destination:** `localhost:3000`
   - Click **Edit**

3. **Update General Tab**
   - Protocol: `HTTP` (or `HTTPS` if using SSL)
   - Source: Keep existing
   - Destination: `localhost:3000`
   - Enable WebSocket: **✓ Checked** (if available)

4. **Update Custom Header Tab (if available)**
   Add/verify these headers:
   ```
   X-Real-IP: $remote_addr
   X-Forwarded-For: $proxy_add_x_forwarded_for
   X-Forwarded-Proto: $scheme
   ```

5. **Update Advanced Settings (CRITICAL)**
   Look for these fields and update:

   | Field Name (Synology UI)          | Value      | Notes                              |
   |-----------------------------------|------------|------------------------------------|
   | Client max body size              | `200`      | Megabytes (was likely 100)         |
   | Client request timeout            | `3600`     | Seconds (1 hour)                   |
   | Proxy connect timeout             | `60`       | Seconds                            |
   | Proxy send timeout                | `3600`     | Seconds (1 hour)                   |
   | Proxy read timeout                | `3600`     | Seconds (1 hour)                   |
   | Send timeout                      | `3600`     | Seconds                            |
   | Keepalive timeout                 | `300`      | Seconds (5 minutes)                |

   **⚠️ Synology UI Variations:**
   - Older DSM versions may use different labels
   - Some fields may be under "Advanced Settings" or "Nginx Settings"
   - If a field doesn't exist, skip it

6. **Enable Buffering Passthrough (if available)**
   - Look for "Enable request buffering" → **Uncheck** (off)
   - Look for "Enable response buffering" → **Uncheck** (off)

   **Why:** Buffering causes Synology to wait for entire upload before forwarding to backend, defeating streaming.

7. **Save and Apply**
   - Click **OK** or **Save**
   - Changes apply immediately (no restart needed)

8. **Verify Settings**
   ```bash
   # SSH into Synology NAS
   ssh admin@192.168.1.41

   # View Nginx config (Synology generates this, do not edit directly)
   sudo cat /etc/nginx/app.d/server.ReverseProxy.conf | grep -A 20 "pardysurveys"
   ```

   Look for:
   ```nginx
   client_max_body_size 200m;
   client_body_timeout 3600s;
   proxy_read_timeout 3600s;
   # etc.
   ```

---

## 4️⃣  Test Harness (1 Mbps / 500ms RTT)

### Linux/macOS: Traffic Control (tc)

**Requirements:** Linux with `iproute2` package, root access.

#### Setup Slow Link Simulation

```bash
# Identify your network interface
ip link show
# or
ifconfig

# Common interfaces: eth0, wlan0, enp0s3

# Apply 1 Mbps + 500ms RTT + 1% loss (requires root)
INTERFACE="eth0"  # Change to your interface

sudo tc qdisc add dev $INTERFACE root handle 1: htb default 12
sudo tc class add dev $INTERFACE parent 1: classid 1:12 htb rate 1mbit ceil 1mbit
sudo tc qdisc add dev $INTERFACE parent 1:12 handle 10: netem delay 250ms loss 1%

# Verify
sudo tc qdisc show dev $INTERFACE
```

**Expected output:**
```
qdisc htb 1: root refcnt 2 r2q 10 default 0x12 direct_packets_stat 0 direct_qlen 1000
qdisc netem 10: parent 1:12 limit 1000 delay 250ms loss 1%
```

#### Run Smoke Tests with Slow Link

```bash
# Run automated test script (includes tc setup + tests + cleanup)
cd /volume1/Pardy\ Surveys/Data\ Sync/trimble-sync
sudo ./tools/slowlink_smoke.sh eth0

# Or manually:
# 1. Apply tc rules (above)
# 2. Run tests:
node tools/upload-smoke.js
# 3. Remove tc rules:
sudo tc qdisc del dev $INTERFACE root
```

#### Cleanup (Remove Traffic Shaping)

```bash
sudo tc qdisc del dev $INTERFACE root
```

---

### Windows: PowerShell Limitations

**⚠️ Windows does not have built-in traffic shaping equivalent to Linux `tc`.**

**Alternatives:**

1. **Use Linux VM or WSL2**
   ```powershell
   # Install Ubuntu in WSL2
   wsl --install -d Ubuntu

   # Then follow Linux tc instructions inside WSL
   ```

2. **Use Third-Party Tools**
   - **Clumsy** (GUI): https://github.com/jagt/clumsy
   - **NetLimiter** (commercial): https://www.netlimiter.com/

3. **Manual Testing via Public Hotspot**
   - Use phone hotspot or public WiFi with known poor speeds
   - Verify speed with Speedtest: https://www.speedtest.net/
   - Target: ≤1 Mbps upstream, 400-600ms ping

4. **Windows QoS Policies (Limited)**
   ```powershell
   # Create rate limit (administrator PowerShell)
   New-NetQosPolicy -Name "Slow Upload Test" -AppPathNameMatchCondition "node.exe" -ThrottleRateActionBitsPerSecond 1MB

   # Run tests
   node tools/upload-smoke.js

   # Remove policy
   Remove-NetQosPolicy -Name "Slow Upload Test"
   ```

   **Note:** This limits rate but does NOT add latency or packet loss. Not a true simulation.

---

### curl Test Samples

#### Upload 2 MB File (Expected: ~16 seconds at 1 Mbps)

```bash
# Create test file
dd if=/dev/zero of=test-2mb.bin bs=1M count=2

# Upload to server
time curl -X POST \
  -F "jobPath=test-job/25-100" \
  -F "files=@test-2mb.bin" \
  http://192.168.1.41:3000/api/upload-field-data-android

# Expected duration: ~16-20 seconds
# Response includes uploadId:
# {"success":true,"uploadId":"abc-123-def",...}
```

#### Upload 10 MB File (Expected: ~80 seconds at 1 Mbps)

```bash
# Create 10 MB file
dd if=/dev/zero of=test-10mb.bin bs=1M count=10

# Upload
time curl -X POST \
  -F "jobPath=test-job/25-200" \
  -F "files=@test-10mb.bin" \
  http://192.168.1.41:3000/api/upload-field-data-android

# Expected duration: ~80-100 seconds
```

#### Poll Progress API

```bash
# Get uploadId from upload response
UPLOAD_ID="abc-123-def-456"

# Poll status every 3 seconds
while true; do
  curl -s "http://192.168.1.41:3000/api/upload-status/$UPLOAD_ID" | jq .
  sleep 3
done

# Stop with Ctrl+C
```

**Expected progress response:**
```json
{
  "status": "ok",
  "uploadId": "abc-123-def-456",
  "jobPath": "test-job/25-200",
  "fileCount": 1,
  "status": "started",
  "bytesReceived": 5242880,
  "startTime": 1729000000000,
  "lastUpdate": 1729000010000
}
```

---

## 5️⃣  Smoke Tests

### Node.js Smoke Test

**File:** `tools/upload-smoke.js`

**What it tests:**
- Server health check
- Small file upload (2 MB)
- Medium file upload (10 MB)
- Multi-file upload (3 files)
- Progress API listing
- Log file entries

**Run:**

```bash
cd /volume1/Pardy\ Surveys/Data\ Sync/trimble-sync

# Default (localhost:3000)
node tools/upload-smoke.js

# Custom server URL
SERVER_URL=http://192.168.1.41:3000 node tools/upload-smoke.js

# With progress API enabled
UPLOAD_PROGRESS_API=true node tools/upload-smoke.js
```

**Expected output:**
```
=================================================
   TRIMBLE SYNC - UPLOAD SMOKE TESTS
=================================================

Server: http://localhost:3000
Progress API: Disabled

Test 1: Health check...
✓ Server is healthy

Test 2: Upload small file (2 MB)...
✓ Upload succeeded in 245ms
✓ Upload ID: abc-123-def
  Checking log entries...
✓ Log contains: "Upload started"
✓ Log contains: "File uploaded"
✓ Log contains: "Upload completed"

Test 3: Upload medium file (10 MB)...
✓ Upload succeeded in 1205ms
  Upload speed: 8.45 MB/s
✓ Total bytes match expected size

Test 4: Upload multiple files...
✓ Multi-file upload succeeded (3 files)

=================================================
   TEST SUMMARY
=================================================

Total tests: 10
Passed: 10
Failed: 0

✅ ALL TESTS PASSED
```

### Integration Test with Traffic Shaping

**File:** `tools/slowlink_smoke.sh`

**What it does:**
1. Applies `tc` traffic shaping (1 Mbps, 500ms RTT, 1% loss)
2. Runs `upload-smoke.js`
3. Checks `sync-activity.log` for required entries
4. Cleans up `tc` rules automatically

**Run:**

```bash
cd /volume1/Pardy\ Surveys/Data\ Sync/trimble-sync

# Run with default interface (eth0)
sudo ./tools/slowlink_smoke.sh

# Or specify interface
sudo ./tools/slowlink_smoke.sh wlan0
```

**Expected behavior:**
- Uploads take significantly longer (~16s for 2MB)
- All tests should still PASS
- Log file shows complete upload lifecycle

**Cleanup:** Script automatically removes `tc` rules on exit (even if Ctrl+C).

---

## 6️⃣  Rollout Plan & Rollback

### Phase 1: Staging (Extended Timeouts + Progress API)

**Goal:** Improve visibility and timeout tolerance with minimal risk.

**Steps:**

1. **Edit docker-compose.yml:**
   ```yaml
   environment:
     # ... existing vars ...
     - UPLOAD_PROGRESS_API=true         # ← Enable
     - SERVER_TIMEOUT_MS=600000         # ← 10 minutes (was 120000)
     - SERVER_KEEPALIVE_MS=65000        # ← Keep default
   ```

2. **Deploy:**
   ```bash
   cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
   sudo docker-compose up -d --build
   ```

3. **Verify:**
   ```bash
   # Check logs for new config
   sudo docker-compose logs trimble-sync | tail -20

   # Should show:
   # Upload resilience config: { ..., progressAPI: true, timeout: '600000ms', ... }

   # Test progress API
   curl http://192.168.1.41:3000/api/upload-status
   # Should return: {"active":[]}

   # Access status UI
   # Open browser: http://192.168.1.41:3000/upload-status.html
   ```

4. **Monitor (1 week):**
   - Check `sync-activity.log` daily for upload duration/speeds
   - Share `upload-status.html` URL with field crews
   - Watch for timeout errors (should reduce)
   - Verify RAM usage stable (no OOM)

**Success Criteria:**
- No regression in upload success rate
- Longer uploads (>2 min) now succeed
- Field crews can view progress on their phones

---

### Phase 2: Production (Streaming + Checksums + Idempotency)

**Prerequisites:** Phase 1 stable for 1 week, no regressions.

**Steps:**

1. **Edit docker-compose.yml:**
   ```yaml
   environment:
     # ... existing vars from Phase 1 ...
     - UPLOAD_STREAMING_ENABLED=true    # ← Enable disk streaming
     - UPLOAD_CHECKSUM_ENABLED=true     # ← Enable MD5 verification
     - UPLOAD_IDEMPOTENCY_ENABLED=true  # ← Enable duplicate detection
   ```

2. **Deploy:**
   ```bash
   cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
   sudo docker-compose up -d --build
   ```

3. **Verify:**
   ```bash
   # Check logs
   sudo docker-compose logs trimble-sync | grep "Upload mode"
   # Should show: Upload mode: STREAMING (disk)

   # Check that upload temp dir is created
   sudo docker exec trimble-sync ls -la /tmp/uploads
   ```

4. **Monitor (2 weeks):**
   - Check `sync-activity.log` for checksum entries
   - Monitor RAM usage (should be stable or lower)
   - Watch for duplicate upload messages (idempotency working)
   - Verify no file corruption reports

**Success Criteria:**
- RAM usage ≤ 50% during large uploads
- No OOM errors
- Checksums present in upload responses
- Duplicate retries return cached results (faster)

---

### Rollback Procedure

**If issues arise (OOM, errors, crashes):**

#### Quick Rollback (disable all features)

```bash
# SSH into Synology NAS
ssh admin@192.168.1.41

# Navigate to project
cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"

# Edit docker-compose.yml - set all flags to false
sudo vi docker-compose.yml

# Set:
#   - UPLOAD_STREAMING_ENABLED=false
#   - UPLOAD_PROGRESS_API=false
#   - UPLOAD_CHECKSUM_ENABLED=false
#   - UPLOAD_IDEMPOTENCY_ENABLED=false
#   - SERVER_TIMEOUT_MS=120000    # Back to 2 min default

# Restart
sudo docker-compose up -d --build

# Verify rollback
sudo docker-compose logs trimble-sync | grep "Upload mode"
# Should show: Upload mode: LEGACY (memory)
```

#### Verify Rollback Success

```bash
# Check upload config
sudo docker-compose logs trimble-sync | grep "Upload resilience config"

# Expected output (all false):
# {
#   streaming: false,
#   progressAPI: false,
#   checksums: false,
#   idempotency: false,
#   timeout: '120000ms',
#   keepalive: '65000ms'
# }

# Test upload
curl -X POST \
  -F "jobPath=rollback-test" \
  -F "files=@test.bin" \
  http://192.168.1.41:3000/api/upload-field-data-android

# Should work exactly as before patch
```

---

### Phased Flag Activation Summary

| Phase | Flags Enabled                                  | Risk Level | Monitoring Period |
|-------|------------------------------------------------|------------|-------------------|
| **0** | None (all false)                               | None       | Baseline          |
| **1** | `UPLOAD_PROGRESS_API`, `SERVER_TIMEOUT_MS`     | Very Low   | 1 week            |
| **2** | Add `UPLOAD_STREAMING_ENABLED`, `CHECKSUM`, `IDEMPOTENCY` | Low | 2 weeks |

---

## 7️⃣  Known Limitations

### ⚠️ CRITICAL: Android Client Timeout Ceiling

```
╔═══════════════════════════════════════════════════════════════════╗
║  HARD CONSTRAINT: 15 MB FILE SIZE LIMIT AT 1 MBPS               ║
║                                                                   ║
║  The Android client has a hard-coded 120-second write timeout.   ║
║  At 1 Mbps upstream, this limits reliable uploads to ~15 MB.     ║
║                                                                   ║
║  Server improvements CANNOT override this client-side timeout.   ║
║                                                                   ║
║  Math: 1 Mbps = 125 KB/s × 120s = 15 MB maximum                 ║
║                                                                   ║
║  Files >15 MB will ALWAYS fail at 1 Mbps until client updated.  ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Source:** `Android_App/app/src/main/java/com/pardysurveys/datasync/FieldDataUploadWorker.java:74`

```java
OkHttpClient client = new OkHttpClient.Builder()
    .writeTimeout(120, TimeUnit.SECONDS)   // ← Cannot change server-side
    .build();
```

**Impact:**
- Typical survey data (JXL, CSV, small photos): ✅ **Works fine** (usually <10 MB)
- Large photo batches or high-res images: ⚠️ **May timeout**
- Video files: ❌ **Will fail**

**Workarounds:**
1. **Field crews:** Upload more frequently (smaller batches)
2. **Future:** Increase client timeout to 600s (10 min) for 75 MB ceiling
3. **Alternative:** Implement chunked uploads (requires client changes)

---

### Synology Reverse Proxy Config

**Cannot be automated.** Operator must manually configure via DSM web UI.

**Workaround:** Direct access bypasses reverse proxy but loses remote access:
- Internal: `http://192.168.1.41:3000` ✅ No proxy
- External: `http://pardysurveys.direct.quickconnect.to:3000` ⚠️ Through Synology proxy

---

### Windows Testing

Windows lacks `tc` equivalent. Use:
- WSL2 with Linux
- Third-party tools (Clumsy, NetLimiter)
- Real slow hotspot

---

## 8️⃣  Acceptance Criteria

All criteria below **MUST pass** before production deployment:

| # | Criterion                                      | Verification Method                          | Status |
|---|------------------------------------------------|----------------------------------------------|--------|
| 1 | 10 MB file uploads successfully at 1 Mbps     | `sudo ./tools/slowlink_smoke.sh`             | ⬜     |
| 2 | No OOM errors during upload                    | `docker stats trimble-sync` during test      | ⬜     |
| 3 | Checksums match (end-to-end integrity)         | Check `files[].checksum` in response         | ⬜     |
| 4 | Server returns 200 OK within timeout           | `curl` test completes without error          | ⬜     |
| 5 | Progress API shows real-time upload status     | Open `upload-status.html`, watch live update | ⬜     |
| 6 | Logs contain start/progress/completion entries| `tail -f sync-activity.log` during upload    | ⬜     |
| 7 | No controller/Android app changes required     | Use existing APK, no rebuild                 | ⬜     |
| 8 | Default behavior unchanged (all flags false)   | Rollback test: flags=false works as before   | ⬜     |
| 9 | Duplicate upload returns cached result         | Upload same file twice, 2nd is instant       | ⬜     |
| 10| Rollback succeeds and restores old behavior   | Set all flags false, redeploy, test upload   | ⬜     |

---

## 9️⃣  Operations Cheat Sheet

### Quick Commands

```bash
# Restart server
sudo docker-compose restart trimble-sync

# View real-time logs
sudo docker-compose logs -f trimble-sync

# Check RAM usage
docker stats trimble-sync --no-stream

# View recent uploads in log
tail -50 /volume1/Pardy\ Surveys/Data\ Sync/trimble-sync/sync-activity.log | grep -i upload

# Enable progress API (quick)
cd "/volume1/Pardy Surveys/Data Sync/trimble-sync"
sudo vi docker-compose.yml  # Set UPLOAD_PROGRESS_API=true
sudo docker-compose up -d

# Check active uploads
curl http://192.168.1.41:3000/api/upload-status
```

### Monitoring Metrics

**Watch these during rollout:**

```bash
# 1. Upload success rate
grep "Upload completed" sync-activity.log | wc -l
grep "Upload.*failed" sync-activity.log | wc -l

# 2. Average upload speed (from log)
grep "Upload completed" sync-activity.log | tail -20

# 3. RAM usage
docker stats trimble-sync --no-stream | awk '{print $7}'

# 4. Error rate
grep -i error sync-activity.log | tail -20
```

---

## 🎯 Success Indicators

**You'll know the patch is working when:**

1. ✅ Uploads at 1 Mbps complete successfully (small-medium files)
2. ✅ Field crews can see upload progress on phones
3. ✅ `sync-activity.log` shows detailed upload lifecycle
4. ✅ RAM usage stable (no spikes to 100%)
5. ✅ Duplicate retries return instantly (idempotency working)
6. ✅ Server stays up during slow uploads (no timeouts)

**Red flags (rollback immediately):**

1. ❌ Upload success rate drops vs. baseline
2. ❌ OOM errors in logs
3. ❌ Server crashes or restarts
4. ❌ Corrupted files (checksum mismatches)

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue:** Progress API returns 404
- **Cause:** Flag disabled
- **Fix:** Set `UPLOAD_PROGRESS_API=true`, redeploy

**Issue:** Upload succeeds but uses RAM spike
- **Cause:** Streaming disabled
- **Fix:** Set `UPLOAD_STREAMING_ENABLED=true`, redeploy

**Issue:** Upload times out after 2 minutes
- **Cause:** Default timeout still active
- **Fix:** Set `SERVER_TIMEOUT_MS=600000`, redeploy

**Issue:** Large files (>15 MB) always fail
- **Cause:** Android client 120s write timeout (not fixable server-side)
- **Fix:** Plan client update or advise smaller batches

---

## 📚 Related Documentation

- Original diagnosis: See "DIAGNOSIS & LIMITS (SERVER-ONLY)" section above
- Android client code: `Android_App/app/src/main/java/com/pardysurveys/datasync/`
- Synology QuickConnect: https://www.synology.com/en-us/knowledgebase/DSM/help/DSM/AdminCenter/connection_quickconnect

---

**END OF IMPLEMENTATION DOCUMENTATION**

*Prepared by: Senior Backend Engineer (Claude)*
*Date: 2025-10-15*
*Version: 1.0.0*
