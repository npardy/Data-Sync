# Field Status Implementation

## Overview

This document describes the field work tracking system implemented for the Data Sync application. The system collects field status information before each upload from the Trimble TSC5 controller, creating a structured JSON file alongside the uploaded data for QuickBooks Online integration and job tracking.

**Key Goals:**
- Track operator time and field work completion status
- Support job-specific questions (pins, construction tasks) based on job type
- Enable QuickBooks Online time entry sync
- Maintain backward compatibility with existing jobs
- Require minimal changes to Android app (WebView-only approach)

**Implementation Date:** January 2026

---

## Recent Changes

### January 21, 2026

**Change 1: Pins Found Question Added to Topo Job Type**
- Set `asks_pins_found: true` for Topo job type
- Reason: Surveyors may encounter monuments on any job type

**Change 2: Three Upload Types**
- Replaced re-upload checkbox with three radio button options:
  - Intermediate upload (quick backup, operator + notes only)
  - Complete upload (full tracking, default)
  - Re-upload (replace previous)
- Schema change: `is_reupload` → `upload_type`

**Change 3: Automated CSV Data Extraction**
- Server automatically parses CSV files and extracts:
  - Evidence found (FIP*, FIB*)
  - Pins placed (CIP*, PIP*)
  - Evidence not found (PNF count)
  - Evidence to find (FIND* count)
  - Monument checks (*-CKS numbers)
- Data stored in `csv_extracted` field of field_status.json
- CSV has no header row (first line is data)
- Enables automated invoice generation and progress tracking

**Change 4: Form Closing Bug Fix** (January 21, 2026)
- Fixed form closing before POST completes on slow connections
- Form now stays open if network error occurs
- User can retry failed submissions

---

## Files Modified

### 1. `server.js`

**Line 20:** Added pending field status store
```javascript
const pendingFieldStatus = new Map();
```

**Lines 519-548:** New endpoint `/api/store-pending-field-status`
- Accepts field status data before upload starts
- Stores in memory with 5-minute auto-cleanup
- Returns success/error response

**Lines 1132-1146:** Changed upload folder timestamp format
- **OLD:** `MMDDYY-HHMMAM` (e.g., `010726-0925AM`)
- **NEW:** `YYMMDD-HHMMAM` (e.g., `260107-0925AM`)

**Lines 1274-1285:** Job type persistence logic
- Updates `job_info.json` with `jobType` if missing
- Reads from pending field status

**Lines 1292-1357:** Field status JSON creation
- Retrieves pending status from Map
- Transforms camelCase to snake_case
- Writes `field_status.json` to upload folder
- Cleans up pending store after write

**Lines 305-340:** Job creation endpoint updated
- Added `jobType` parameter
- Defaults to `'survey_rpr'` if not provided
- Saves to `job_info.json`

### 2. `public/app.js`

**Lines 157-168:** New job state includes job type
```javascript
const [newJobData, setNewJobData] = useState({
    // ... existing fields
    jobType: 'survey_rpr',
    customJobType: ''
});
```

**Lines 178-196:** Field status form state
- All form fields (operator, times, pins, tasks, notes)
- Includes both `jobPath` and `cleanJobPath` for proper routing

**Lines 198-242:** Job type configuration object
- Defines which questions to ask for each job type
- Controls pins questions and construction checklist visibility

**Lines 448-510:** `handleUploadFieldData` function
- Strips `.job` extension from path for API calls
- Fetches `job_info.json` to check for existing job type
- Sets up field status form data
- Shows form dialog

**Lines 512-604:** `handleFieldStatusSubmit` function
- Validates all required fields
- Builds field status object (camelCase)
- POSTs to `/api/store-pending-field-status`
- Triggers Android upload via `window.TrimbleSync.uploadFieldData()`

**Lines 1361-1666:** Field status form dialog (Android UI)
- Complete form with all fields
- Conditional rendering based on job type
- Re-upload checkbox with folder selection
- Validation and submit/cancel buttons

**Lines 1700+:** Field status form dialog (Desktop UI - duplicate for dual rendering)

**Lines 900-950 (approx):** Job creation form updated
- Added job type dropdown
- "Other" option with custom text input
- Default value: "Survey & RPR"

### 3. `MainActivity.java`

**Status:** NO CHANGES (Reverted to original)

**Initial Approach (Discarded):** Modified Android app to send field status with files.

**Final Approach:** Android app remains a simple WebView wrapper. All field status logic handled in web UI and server. Android only uploads files as before.

---

## New Features

### 1. Job Type Selection on Job Creation

**Location:** Job creation form (Desktop UI)

**Options:**
- Survey & RPR
- RPR
- Survey
- Building Construction
- Topo
- Subdivision
- Other (with custom text input)

**Storage:** Saved to `job_info.json` as `jobType` field

**Default:** `"survey_rpr"`

### 2. Field Status Form Before Upload

**Trigger:** User clicks "Upload" button on Android app or desktop

**Behavior:**
- Form appears as modal dialog
- Upload does NOT start until form is submitted
- Form adapts based on job type (conditional questions)

**Fields Collected:**

**Always Asked:**
- Operator (text input, default: "Allan")
- Re-upload checkbox
- General notes (textarea)

**For New Uploads (not re-uploads):**
- Time on site (hours, decimal)
- Travel time one-way (hours, decimal)
- Field work complete? (yes/no radio)
- Estimated time remaining (if field work not complete)
- Notes about what's left (if field work not complete)

**Job-Type Specific:**
- **Pins Found:** Survey & RPR, RPR, Survey, Topo, Subdivision
- **Pins Placed:** Survey & RPR, Survey, Topo, Subdivision
- **Construction Checklist:** Building Construction only
  - Forms setup/stripped
  - Rebar placed
  - Inspected & approved
  - Concrete poured
  - Finishing complete

**For Re-uploads:**
- Select which previous upload folder this replaces (dropdown)
- No time tracking or completion questions

### 3. Backward Compatibility

**Problem:** Existing jobs created before this feature lack `jobType` in `job_info.json`

**Solution:**
- Field status form detects missing `jobType`
- Shows yellow warning banner with job type dropdown
- User selects job type on first upload
- Server updates `job_info.json` with selected type
- Future uploads for that job won't show the dropdown

### 4. Upload Folder Date Format Change

**OLD Format:** `MMDDYY-HHMMAM`
- Example: `010726-0925AM` (January 7, 2026 at 9:25 AM)

**NEW Format:** `YYMMDD-HHMMAM`
- Example: `260107-0925AM` (January 7, 2026 at 9:25 AM)

**Reason:** Better alphabetical sorting (chronological order)

**Location:** `Field_Data/` subdirectory within job folder

---

## New API Endpoint

### POST `/api/store-pending-field-status`

**Purpose:** Store field status data in memory before Android initiates file upload

**Request Body:**
```json
{
  "jobPath": "26-000-050/26-001/26-001-260106",
  "fieldStatus": {
    "operator": "Allan",
    "isReupload": false,
    "replacesFolder": null,
    "timeOnSite": "2.5",
    "travelTime": "0.5",
    "fieldWorkDone": "yes",
    "estimatedTimeRemaining": null,
    "notesWhatLeft": null,
    "pinsFound": "yes",
    "pinsPlaced": "partial",
    "constructionTasks": ["forms_setup", "rebar_placed"],
    "customTasks": "Installed temporary shoring",
    "notes": "Weather delayed start by 1 hour",
    "jobType": "survey_rpr",
    "updateJobType": false
  }
}
```

**Response (Success):**
```json
{
  "success": true
}
```

**Response (Error):**
```json
{
  "error": "jobPath and fieldStatus are required"
}
```

**Storage:**
- Data stored in `pendingFieldStatus` Map (in-memory)
- Keyed by `jobPath`
- Auto-cleanup after 5 minutes if upload never happens

**Usage Flow:**
1. User submits field status form
2. Web UI POSTs to this endpoint
3. Server stores data in Map
4. Web UI triggers Android upload
5. Android POSTs files to `/api/upload-field-data`
6. Server retrieves pending status from Map during upload
7. Server writes `field_status.json` to upload folder
8. Server deletes from Map

---

## Schema: field_status.json

### Full Schema (Complete Upload)

```json
{
  "_schema_version": "1.0",
  "job_number": "26-001",
  "controller_job": "26-001-260107",
  "upload_folder": "260107-0925AM",
  "upload_timestamp": "2026-01-07T09:25:00.000Z",

  "operator": "Allan",
  "job_type": "survey_rpr",

  "upload_type": "complete",
  "replaces_folder": null,

  "time_spent": {
    "field_hours": 2.5,
    "travel_hours_oneway": 0.5
  },

  "field_work_done": true,
  "estimated_time_remaining": null,

  "pins_found": "yes",
  "pins_placed": "partial",

  "construction_tasks_completed": ["forms_setup", "rebar_placed"],
  "custom_tasks_completed": ["Installed temporary shoring"],

  "notes": "Weather delayed start by 1 hour",

  "csv_extracted": {
    "total_points": 176,
    "evidence_found": [
      "0120063 - FIP LEGGE-2024",
      "0120080 - FIP",
      "0120088 - FIP LEGGE-2024"
    ],
    "pins_placed": [
      "0120300 - CIP",
      "0120301 - PIP-PK"
    ],
    "evidence_not_found": 8,
    "evidence_to_find": 3,
    "monument_checks": ["966147"]
  },

  "qbo_sync": {
    "time_synced": false,
    "time_entry_id": null,
    "synced_at": null
  }
}
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `_schema_version` | string | Schema version for future migrations |
| `job_number` | string | Extracted from path (e.g., "26-001") |
| `controller_job` | string | Full controller job folder name |
| `upload_folder` | string | Timestamp folder name (YYMMDD-HHMMAM) |
| `upload_timestamp` | string (ISO 8601) | Upload completion time |
| `operator` | string | Field operator name |
| `job_type` | string | Job type key (e.g., "survey_rpr") |
| `upload_type` | string | "intermediate", "complete", or "reupload" |
| `replaces_folder` | string \| null | Folder name being replaced (reupload only) |
| `time_spent` | object \| null | Null for intermediate/reupload |
| `time_spent.field_hours` | number \| null | Hours spent on site |
| `time_spent.travel_hours_oneway` | number \| null | One-way travel time |
| `field_work_done` | boolean \| null | True if complete, null for intermediate/reupload |
| `estimated_time_remaining` | number \| null | Hours remaining if not done |
| `pins_found` | string \| null | "yes", "no", "partial", "na" (complete only) |
| `pins_placed` | string \| null | "yes", "no", "partial", "na" (complete only) |
| `construction_tasks_completed` | array | Task keys from checklist (complete only) |
| `custom_tasks_completed` | array | Custom task strings (complete only) |
| `notes` | string \| null | General notes or generated message |
| `csv_extracted` | object \| null | Survey point data from CSV (if CSV found) |
| `csv_extracted.total_points` | number | Total number of points in CSV |
| `csv_extracted.evidence_found` | array | FIP*/FIB* points as "pointID - code" |
| `csv_extracted.pins_placed` | array | CIP*/PIP* points as "pointID - code" |
| `csv_extracted.evidence_not_found` | number | Count of PNF points |
| `csv_extracted.evidence_to_find` | number | Count of FIND* points |
| `csv_extracted.monument_checks` | array | Monument numbers from *-CKS codes |
| `qbo_sync.time_synced` | boolean | QBO sync status (always false initially) |
| `qbo_sync.time_entry_id` | string \| null | QBO time entry ID |
| `qbo_sync.synced_at` | string \| null | QBO sync timestamp |

### Upload Type Examples

#### Intermediate Upload

Used when sending data for office review without completing field work for the day.

```json
{
  "_schema_version": "1.0",
  "job_number": "26-001",
  "controller_job": "26-001-260107",
  "upload_folder": "260107-1030AM",
  "upload_timestamp": "2026-01-07T10:30:00.000Z",

  "operator": "Allan",
  "job_type": "survey_rpr",

  "upload_type": "intermediate",
  "replaces_folder": null,

  "time_spent": null,
  "field_work_done": null,
  "estimated_time_remaining": null,

  "pins_found": null,
  "pins_placed": null,

  "construction_tasks_completed": [],
  "custom_tasks_completed": [],

  "notes": "First half of lot collected, sending for review",

  "csv_extracted": {
    "total_points": 82,
    "evidence_found": ["0120063 - FIP"],
    "pins_placed": [],
    "evidence_not_found": 3,
    "evidence_to_find": 2,
    "monument_checks": []
  },

  "qbo_sync": {
    "time_synced": false,
    "time_entry_id": null,
    "synced_at": null
  }
}
```

#### Re-upload Example

Used when fixing or replacing a previous upload.

```json
{
  "_schema_version": "1.0",
  "job_number": "26-001",
  "controller_job": "26-001-260107",
  "upload_folder": "260107-1130AM",
  "upload_timestamp": "2026-01-07T11:30:00.000Z",

  "operator": "Allan",
  "job_type": "survey_rpr",

  "upload_type": "reupload",
  "replaces_folder": "260107-0925AM",

  "time_spent": null,
  "field_work_done": null,
  "estimated_time_remaining": null,

  "pins_found": null,
  "pins_placed": null,

  "construction_tasks_completed": [],
  "custom_tasks_completed": [],

  "notes": "Re-upload - replaces 260107-0925AM",

  "csv_extracted": {
    "total_points": 176,
    "evidence_found": ["0120063 - FIP LEGGE-2024", "0120080 - FIP"],
    "pins_placed": ["0120300 - CIP"],
    "evidence_not_found": 8,
    "evidence_to_find": 3,
    "monument_checks": ["966147"]
  },

  "qbo_sync": {
    "time_synced": false,
    "time_entry_id": null,
    "synced_at": null
  }
}
```

---

## Data Flow

### Upload Process (Step-by-Step)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER CLICKS "UPLOAD" BUTTON                                  │
│    • Android app or desktop browser                             │
│    • Calls: handleUploadFieldData(jobPath)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. PATH CLEANING                                                 │
│    • Strip .job extension if present                            │
│    • jobPath: "26-001/26-001-260106/26-001-260106.job"         │
│    • cleanJobPath: "26-001/26-001-260106"                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. FETCH JOB INFO                                                │
│    • GET /api/download-file/{cleanJobPath}/job_info.json        │
│    • Check if jobType exists                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. SHOW FIELD STATUS FORM                                        │
│    • setShowFieldStatusForm(true)                               │
│    • Form adapts based on jobType (or shows type selector)      │
│    • User fills in all fields                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. USER CLICKS "UPLOAD FIELD DATA"                              │
│    • Calls: handleFieldStatusSubmit()                           │
│    • Validates all required fields                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. STORE FIELD STATUS ON SERVER                                 │
│    • POST /api/store-pending-field-status                       │
│    • Body: { jobPath, fieldStatus }                             │
│    • Server stores in pendingFieldStatus Map                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. TRIGGER ANDROID UPLOAD                                        │
│    • window.TrimbleSync.uploadFieldData(jobPath)                │
│    • Android reads files from TSC5 controller                   │
│    • Android POSTs to /api/upload-field-data                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. SERVER PROCESSES UPLOAD                                       │
│    • Receives multipart file upload                             │
│    • Creates timestamped folder (YYMMDD-HHMMAM)                 │
│    • Saves all files to Field_Data/{timestamp}/                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. RETRIEVE PENDING FIELD STATUS                                 │
│    • const pendingStatus = pendingFieldStatus.get(jobPath)      │
│    • Extract fieldStatusData from pending store                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. UPDATE job_info.json (if needed)                            │
│    • If updateJobType flag is true                              │
│    • Add jobType to job_info.json                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 11. CREATE field_status.json                                     │
│    • Transform camelCase → snake_case                           │
│    • Parse strings to numbers where needed                      │
│    • Convert "yes"/"no" to boolean                              │
│    • Write to Field_Data/{timestamp}/field_status.json          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 12. UPDATE job_info.json WITH UPLOAD RECORD                     │
│    • Add entry to fieldDataUploads array                        │
│    • Save uploadId, timestamp, folder, fileCount, bytes         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 13. CLEANUP                                                      │
│    • pendingFieldStatus.delete(jobPath)                         │
│    • Return success response to Android                         │
│    • UI shows upload complete                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architecture Decisions

**Why Pending Store Approach?**
- Android app is just a WebView wrapper
- Avoids modifying Android Java code (no APK rebuild needed)
- Web UI can be updated by simply editing files
- Server acts as intermediary between form submission and file upload

**Why Two jobPath Variables?**
- Android uses full path including `.job` filename
- API endpoints expect directory path without filename
- `cleanJobPath` strips extension for API calls
- Original `jobPath` preserved for Android upload trigger

**Why In-Memory Map Instead of Database?**
- Temporary data (only needed for ~30 seconds)
- Auto-cleanup prevents memory leaks
- No persistence needed (upload happens immediately)
- Simpler than database or file storage

---

## Job Type Configuration

### JOB_TYPE_CONFIG Object

Location: `app.js` lines 198-242

```javascript
const JOB_TYPE_CONFIG = {
    "survey_rpr": {
        label: "Survey & RPR",
        asks_pins_found: true,
        asks_pins_placed: true,
        construction_checklist: false
    },
    "rpr": {
        label: "RPR",
        asks_pins_found: true,
        asks_pins_placed: false,
        construction_checklist: false
    },
    "survey": {
        label: "Survey",
        asks_pins_found: true,
        asks_pins_placed: true,
        construction_checklist: false
    },
    "building_construction": {
        label: "Building Construction",
        asks_pins_found: false,
        asks_pins_placed: false,
        construction_checklist: true
    },
    "topo": {
        label: "Topo",
        asks_pins_found: true,
        asks_pins_placed: false,
        construction_checklist: false
    },
    "subdivision": {
        label: "Subdivision",
        asks_pins_found: true,
        asks_pins_placed: true,
        construction_checklist: false
    },
    "other": {
        label: "Other",
        asks_pins_found: false,
        asks_pins_placed: false,
        construction_checklist: false
    }
};
```

### Construction Checklist Tasks

When `construction_checklist: true`:

| Task Key | Label |
|----------|-------|
| `forms_setup` | Forms setup/stripped |
| `rebar_placed` | Rebar placed |
| `inspected_approved` | Inspected & approved |
| `concrete_poured` | Concrete poured |
| `finishing_complete` | Finishing complete |

Stored in `field_status.json` as:
```json
"construction_tasks_completed": ["forms_setup", "rebar_placed"]
```

### Adding New Job Types

1. Add entry to `JOB_TYPE_CONFIG` object
2. Add option to job creation dropdown (line ~930)
3. Configure which questions to ask using flags:
   - `asks_pins_found` - Show "Pins Found" question
   - `asks_pins_placed` - Show "Pins Placed" question
   - `construction_checklist` - Show construction task checklist

---

## Testing Notes

### How to Verify Implementation

#### 1. Test Job Creation with Job Type

**Steps:**
1. Open desktop web UI
2. Navigate to job folder (e.g., `26-000-050/`)
3. Click "New Job"
4. Fill in job details
5. **Select job type** from dropdown
6. Click "Create Job"

**Expected:**
- `job_info.json` created with `jobType` field
- Value matches selection (e.g., `"survey_rpr"`)

**Verify:**
```bash
cat "Z:\Data Sync\office-jobs\26-000-050\26-XXX\26-XXX-YYMMDD\job_info.json"
```

#### 2. Test Field Status Form on Upload

**Steps:**
1. Open Android app (or desktop for testing)
2. Navigate to TSC5 jobs
3. Select a job with existing `jobType`
4. Click "Upload"

**Expected:**
- Field status form appears immediately
- Form shows job number and address in header
- No job type dropdown (job already has type)
- All appropriate fields visible based on job type

**Verify:**
- Form is blocking (cannot upload without submitting)
- Cancel button closes form without upload
- Required fields enforced

#### 3. Test Backward Compatibility

**Steps:**
1. Find or create a job without `jobType` in `job_info.json`
2. Click "Upload"

**Expected:**
- Field status form appears
- **Yellow warning banner** shows: "This job doesn't have a type set"
- Job type dropdown visible
- User must select type before submitting

**After Submit:**
- `job_info.json` updated with selected `jobType`
- Future uploads won't show the dropdown

**Verify:**
```bash
cat "Z:\Data Sync\office-jobs\26-000-050\26-XXX\26-XXX-YYMMDD\job_info.json"
# Should now have "jobType": "survey_rpr" or whatever was selected
```

#### 4. Test Upload with Field Status

**Steps:**
1. Fill out complete field status form:
   - Operator: "Allan"
   - Time on site: 2.5
   - Travel time: 0.5
   - Field work done: Yes
   - Pins found: Yes
   - Pins placed: Partial
   - Notes: "Test upload"
2. Click "Upload Field Data"

**Expected:**
- Form closes
- Upload progress appears
- Files upload to Field_Data/{YYMMDD-HHMMAM}/
- `field_status.json` created in upload folder

**Verify:**
```bash
ls "Z:\Data Sync\office-jobs\26-000-050\26-XXX\26-XXX-YYMMDD\Field_Data\"
# Should see folder like: 260120-0938AM

cat "Z:\Data Sync\office-jobs\26-000-050\26-XXX\26-XXX-YYMMDD\Field_Data\260120-0938AM\field_status.json"
```

**Check JSON Structure:**
- All fields present and correct types
- `time_spent.field_hours` is number (not string)
- `field_work_done` is boolean
- `pins_found` and `pins_placed` match selections
- `notes` contains entered text
- `qbo_sync` object initialized

#### 5. Test Re-upload

**Steps:**
1. Upload to a job that already has uploads
2. Check "This is a re-upload" checkbox

**Expected:**
- "Replaces which upload?" dropdown appears
- Lists previous upload folders
- Time/completion fields hidden

**After Submit:**
- `field_status.json` has:
  - `is_reupload: true`
  - `replaces_folder: "260107-0925AM"` (or selected)
  - `time_spent: null`
  - `field_work_done: null`
  - `notes: "Re-upload - replaces 260107-0925AM"`

#### 6. Test Timestamp Format

**Expected:** New uploads create folders with format `YYMMDD-HHMMAM`

**Examples:**
- Jan 7, 2026 9:25 AM → `260107-0925AM`
- Dec 31, 2025 3:45 PM → `251231-0345PM`

**Verify Sorting:**
```bash
ls -1 "Z:\Data Sync\office-jobs\26-000-050\26-XXX\26-XXX-YYMMDD\Field_Data\" | sort
# Folders should be in chronological order
```

#### 7. Test Construction Job Type

**Steps:**
1. Create or find job with `jobType: "building_construction"`
2. Click "Upload"

**Expected:**
- Form shows construction checklist
- NO pins questions
- Checkboxes for: forms, rebar, inspection, concrete, finishing

**After Submit:**
- `field_status.json` has:
  - `construction_tasks_completed: ["forms_setup", "rebar_placed"]` (or checked items)
  - `pins_found: null`
  - `pins_placed: null`

#### 8. Test Error Handling

**Test 404 Error (server not updated):**
- Expected: "Failed to store field status: Server returned 404"
- **Fix:** Restart Docker container

**Test Validation:**
- Leave operator blank → "Please fill in all required fields"
- Select job type "Other" without custom text → "Please enter a custom job type"
- Mark field work "No" without time estimate → Error message

**Test Network Issues:**
- Disconnect network → Fetch fails with clear error message

### Server Restart Required

⚠️ **IMPORTANT:** After modifying `server.js`, you MUST restart the Docker container on Synology NAS:

```bash
# SSH into Synology
docker restart trimble-sync

# Or via Synology Docker UI:
# 1. Open Docker app
# 2. Find trimble-sync container
# 3. Click Action → Restart
```

---

## Known Issues & Audit Findings

### ⚠️ Issue 1: estimated_time_remaining Type Mismatch

**Severity:** Medium

**Location:** `server.js:1324`

**Issue:**
Form sends `estimated_time_remaining` as string (e.g., `"3.5"`), but it's not parsed to float like other time fields.

**Current Code:**
```javascript
estimated_time_remaining: fieldStatusData.isReupload ? null : fieldStatusData.estimatedTimeRemaining || null,
```

**Expected:**
```javascript
estimated_time_remaining: fieldStatusData.isReupload ? null : (parseFloat(fieldStatusData.estimatedTimeRemaining) || null),
```

**Impact:**
- JSON contains `"3.5"` (string) instead of `3.5` (number)
- May cause issues with QuickBooks integration
- Inconsistent with `field_hours` and `travel_hours_oneway`

**Fix Priority:** High (before QBO integration)

### ⚠️ Issue 2: custom_tasks_completed Structure

**Severity:** Low

**Location:** `server.js:1330`

**Issue:**
Form collects custom tasks as single string, server wraps in array.

**Current Code:**
```javascript
custom_tasks_completed: fieldStatusData.customTasks ? [fieldStatusData.customTasks] : [],
```

**Result:**
```json
"custom_tasks_completed": ["Installed formwork, poured foundation"]
```

**Question:** Should this be split into multiple tasks?

**Options:**
1. **Keep as-is** - Single string in array (current behavior)
2. **Split on comma** - `customTasks.split(',').map(s => s.trim()).filter(Boolean)`

**Recommendation:** Clarify with stakeholders before QBO integration.

---

## Future Enhancements

### Potential Improvements

1. **QuickBooks Online Integration**
   - Sync time entries from `field_status.json`
   - Update `qbo_sync` object after successful sync
   - Handle sync errors and retries

2. **Field Status Editing**
   - Allow editing `field_status.json` after upload
   - UI to view/modify past entries
   - Audit log of changes

3. **Reporting Dashboard**
   - Total hours by operator
   - Job completion status overview
   - Pin placement tracking
   - Construction task progress

4. **Mobile Form Optimization**
   - Larger touch targets
   - Auto-save form progress
   - Offline support (localStorage)

5. **Custom Job Type Templates**
   - Allow creating new job types via UI
   - Save custom question sets
   - Share templates across jobs

6. **Validation Rules**
   - Max hours limit (prevent typos)
   - Required pins for specific job types
   - Cross-field validation (e.g., travel time < field time)

7. **Notes Auto-Population**
   - Template notes for common scenarios
   - Weather condition dropdown
   - Equipment used checklist

---

## Maintenance Guide

### Adding a New Job Type

1. **Update `JOB_TYPE_CONFIG`** in `app.js` (lines 198-242)
2. **Add dropdown option** in job creation form (line ~930)
3. **Add dropdown option** in field status form (lines ~1387 and ~1800)
4. **Restart web browser** to pick up changes (no server restart needed)

### Modifying Form Fields

1. **Update state** in `app.js` (lines 178-196)
2. **Update form inputs** in both Android and Desktop UI sections
3. **Update `handleFieldStatusSubmit`** to include new field
4. **Update server** to write new field to JSON (lines 1305-1341)
5. **Update schema version** if breaking change

### Troubleshooting

**Problem:** Form doesn't appear when clicking Upload

**Check:**
- Browser console for errors (F12)
- `job_info.json` exists and is valid JSON
- Path cleaning logic (`.job` extension handling)

---

**Problem:** "Failed to store field status: Server returned 404"

**Fix:** Restart Docker container on Synology NAS

---

**Problem:** Upload succeeds but no `field_status.json` created

**Check:**
- Server logs for errors during JSON creation
- `pendingFieldStatus` Map has entry (console.log on server)
- jobPath matches between store and upload endpoints

---

**Problem:** Wrong timestamp format in folder names

**Check:**
- Server timezone settings
- Line 1132-1146 in `server.js` for format logic
- Ensure server restarted after changes

---

## Upload Types

The field status form supports three types of uploads, each with different data requirements:

### 1. Intermediate Upload

**Purpose:** Send data for office review while still working in the field.

**When to use:**
- Mid-day data backup
- Sending partial data for office review
- Testing/debugging field data

**Form fields shown:**
- Operator (required)
- Notes (optional)

**field_status.json behavior:**
- `upload_type: "intermediate"`
- Time tracking fields: `null`
- Pins/tasks fields: `null`
- CSV data: Extracted (if CSV present)

### 2. Complete Upload (Default)

**Purpose:** Mark field work complete for the day with full tracking.

**When to use:**
- End of work day
- Job completion
- Normal data upload with time tracking

**Form fields shown:**
- Operator (required)
- Time on site (required)
- Travel time (required)
- Field work complete? (required)
- Estimated time remaining (if not complete)
- Notes (optional)
- Pins found/placed (job type dependent)
- Construction tasks (job type dependent)

**field_status.json behavior:**
- `upload_type: "complete"`
- All time tracking fields populated
- All job-specific fields populated
- CSV data: Extracted (if CSV present)

### 3. Re-upload

**Purpose:** Replace a previous upload (fix errors, add missing data).

**When to use:**
- Correcting previous upload errors
- Adding missing files
- Replacing bad data

**Form fields shown:**
- Operator (required)
- Which upload to replace (required dropdown)

**field_status.json behavior:**
- `upload_type: "reupload"`
- `replaces_folder: "260107-0925AM"` (selected folder)
- Time tracking fields: `null`
- Pins/tasks fields: `null`
- CSV data: Extracted (if CSV present)
- Notes auto-generated: "Re-upload - replaces {folder}"

---

## CSV Data Extraction

When field data is uploaded, the server automatically parses the CSV file and extracts survey point information based on feature codes. This data is stored in the `csv_extracted` section of field_status.json.

### CSV Format Expected

CSV files do not have a header row. The first line contains actual data.

```
0120063,5264969.668,310492.620,93.666,FIP LEGGE-2024
0120080,5264960.123,310500.456,93.500,FIP
0120300,5264950.789,310510.234,93.400,CIP
0120088,5264940.555,310520.111,93.300,PNF
```

**Columns:** Point_ID, Northing, Easting, Elevation, Feature_Code(s)

The 5th column contains feature codes, which can be:
- Single code: `FIP`
- Multiple codes (space-separated): `FIP LEGGE-2024`

### Feature Code Patterns

| Pattern | Type | Stored As | Examples |
|---------|------|-----------|----------|
| `FIP*` or `FIB*` | Evidence Found | Array of "pointID - code" | `FIP`, `FIP-PK`, `FIB`, `FIP LEGGE-2024` |
| `CIP*` or `PIP*` | Pins Placed | Array of "pointID - code" | `CIP`, `PIP-PK`, `CIP-NW` |
| `PNF` | Evidence Not Found | Count only | `PNF` |
| `FIND*` | Evidence To Find | Count only | `FIND`, `FIND-NW`, `FIND NE` |
| `*-CKS` | Monument Checks | Array of monument numbers | `966147-CKS`, `452893-CKS` |

### Extraction Logic

1. **Find CSV file:**
   - Look for files ending in `.csv`
   - Skip files with "layout" or "control" in name (case insensitive)
   - Use first matching file

2. **Parse CSV:**
   - Process all lines (no header row to skip)
   - For each data row:
     - Extract Point_ID (column 1)
     - Extract Feature_Code(s) (column 5)
     - Split codes by whitespace if multiple

3. **Match patterns:**
   - Check each code against patterns above
   - Store according to pattern rules

4. **Handle errors:**
   - If no CSV found: Omit `csv_extracted` section
   - If parsing fails: Omit `csv_extracted` section
   - Upload always succeeds (CSV extraction is optional)

### Example Output

```json
"csv_extracted": {
  "total_points": 176,
  "evidence_found": [
    "0120063 - FIP LEGGE-2024",
    "0120080 - FIP",
    "0120088 - FIP LEGGE-2024"
  ],
  "pins_placed": [
    "0120300 - CIP",
    "0120301 - PIP-PK"
  ],
  "evidence_not_found": 8,
  "evidence_to_find": 3,
  "monument_checks": ["966147", "452893"]
}
```

### Use Cases

- **QuickBooks Integration:** Evidence found/pins placed can be included in invoices
- **Job Progress Tracking:** Monitor pins found vs. to-find, completion status
- **Quality Control:** Verify expected monuments were checked
- **Reporting:** Generate summaries of field work across jobs

---

## Bug Fixes

### Fix 1: Form Closing Before POST Completes (2026-01-21)

**Problem:** The field status form was closing immediately when the user clicked "Upload Field Data", before the POST request to store the pending field status completed. On slow/unreliable field connections, if the POST failed, the user never saw the error and the upload proceeded without storing the field status - resulting in missing field_status.json files.

**Symptom:** Files uploaded successfully but field_status.json was not created (happened in field, worked fine in office).

**Root Cause:** `setShowFieldStatusForm(false)` was called at the start of handleFieldStatusSubmit, outside the try block.

**Fix:** Moved `setShowFieldStatusForm(false)` inside the try block, after confirming the POST succeeded. Now if the POST fails, the form stays open and the user sees the error message and can retry.

**Files Changed:**
- `public/app.js` - handleFieldStatusSubmit function (line 550-612)
- `server.js` - Added warning logs when pending status not found (line 1357-1363)

**Code Changes:**

*app.js - Before:*
```javascript
setShowFieldStatusForm(false);  // ❌ Closed immediately

try {
    const storeResponse = await fetch('/api/store-pending-field-status', {...});
    // ...
} catch (error) {
    alert('Error uploading field data: ' + error.message);  // User never saw this
}
```

*app.js - After:*
```javascript
try {
    const storeResponse = await fetch('/api/store-pending-field-status', {...});

    if (!storeResponse.ok) {
        throw new Error(`Failed to store field status: ${errorMsg}`);
    }

    // ✅ Only close form after successful POST
    setShowFieldStatusForm(false);
    setIsUploading(true);
    window.TrimbleSync.uploadFieldData(fieldStatusData.jobPath);

} catch (error) {
    alert('Error storing field status: ' + error.message + '\n\nPlease check your connection and try again.');
    // ✅ Form stays open - user can retry
}
```

*server.js - Added diagnostic logging:*
```javascript
} else {
  // Log why field_status.json wasn't created
  console.warn(`⚠️  No pending field status found for: ${jobPath}`);
  console.warn(`⚠️  Upload will succeed but field_status.json will NOT be created`);
  console.warn(`⚠️  Pending status may have expired, or POST never reached server`);
  console.warn(`⚠️  Current pending status keys:`, Array.from(pendingFieldStatus.keys()));
}
```

### Change 2: Pins Found Question on All Job Types (2026-01-21)

**Change:** Set asks_pins_found: true for all job types including Topo.

**Reason:** Surveyors may encounter and measure monuments on any type of job, not just boundary surveys.

**Files Changed:**
- public/app.js - JOB_TYPE_CONFIG object (line 226)

### Feature 3: Upload Types and CSV Extraction (2026-01-21)

**Changes:**

1. **Three Upload Types:** Replaced single "re-upload" checkbox with three radio button options:
   - **Intermediate upload** - Operator + optional notes only (for mid-day review)
   - **Complete upload** - Full form with time tracking (default, done for the day)
   - **Re-upload** - Replace previous upload (fix errors)

2. **CSV Data Extraction:** Automatically parse CSV files on upload and extract survey point data:
   - **Evidence found** (FIP*, FIB*) - Stored as array with "pointID - code"
   - **Pins placed** (CIP*, PIP*) - Stored as array with "pointID - code"
   - **Evidence not found** (PNF) - Count only
   - **Evidence to find** (FIND*) - Count only
   - **Monument checks** (*-CKS) - Extract and store monument numbers

3. **Schema Updates:**
   - Changed from `is_reupload: boolean` to `upload_type: string`
   - Added `csv_extracted` object with point data
   - Fixed `estimated_time_remaining` to parse as number (was string)

**Implementation Details:**

- CSV files have **no header row** - first line contains actual data
- CSV parsing skips files with "layout" or "control" in filename
- Feature codes can be space-separated (e.g., "FIP LEGGE-2024")
- Extraction runs for ALL upload types (intermediate, complete, reupload)
- Upload succeeds even if CSV not found or parsing fails

**Reason:**

- **Intermediate uploads:** Allow mid-day data backup/review without time tracking overhead
- **CSV extraction:** Enable automatic invoice generation and progress tracking without manual CSV review
- **Better data structure:** Three-state upload type is more explicit than boolean flag
- **Automated data entry:** Eliminate manual CSV review for billing and progress reports

**Files Changed:**
- public/app.js - Field status form UI (lines 178-196, 530-555, 1438-1689, 2275-2526)
- server.js - CSV parsing functions (lines 34-140)
- server.js - field_status.json creation with upload_type and csv_extracted (lines 1412-1463)
- FIELD_STATUS_IMPLEMENTATION.md - Documentation updated with upload types and CSV extraction

**Backward Compatibility:**

- Old field_status.json files with `is_reupload` remain valid
- Server defaults `upload_type` to "complete" if not provided
- CSV extraction is optional (upload succeeds even if CSV not found)
- No database migrations required

---

## Contact & Support

For issues or questions about this implementation:

1. Review this documentation first
2. Check browser console for client-side errors
3. Check server logs (Docker logs) for server-side errors
4. Verify Docker container is running updated code

**Implementation By:** Claude Code
**Date:** January 2026
**Version:** 1.0
