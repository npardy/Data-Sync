# Prompt for New Claude Code Instance — Data Sync Audit & Implementation

## Who You Are Working For
Nick Pardy, owner of Pardy Surveys, a land surveying company in Newfoundland, Canada. This is his production system — field crews use it daily. Nothing can break.

## Your Working Directory
`\\PS-NAS\Pardy Surveys\Data Sync\` (this is the CURRENT location — the existing live system)

The new location will be `\\PS-NAS\DataSync\` — you will be creating this.

## What To Read First
Read the file `Chat History\Combined Assessment - All Sessions - 260208.md` in its entirety before doing anything else. This is a comprehensive document compiled from 3 previous Claude Code sessions and a markdown plan document. It contains:
- Everything Nick wants built (9 features)
- Complete system architecture
- Every source file listed
- All 26 API endpoints documented
- 28+ security vulnerabilities found
- The mass deletion incident (Feb 7, 2026)
- Complete authentication design (nginx/Authelia)
- Android WebView cookie persistence analysis
- Volume relocation plan
- .job → .jxl conversion analysis
- JXL parsing considerations
- HiveMind integration map
- Implementation phases
- Corrections between sessions (things previous instances got wrong)
- User constraints and non-negotiables
- Comprehensive request forensics / visitor fingerprinting requirements
- Detailed instructions for you

**DO NOT TRUST THAT DOCUMENT BLINDLY.** It was compiled from multiple sessions and there were errors between them. Your job is to independently verify every single claim by reading the actual code yourself.

## Your Mission — In This Order

### Phase A: First Physical Step — Copy Folder & Rename
Before any code auditing or planning, the first thing you need to do is help Nick migrate the files:

1. **Copy the entire contents of `\\PS-NAS\Pardy Surveys\Data Sync\` to `\\PS-NAS\DataSync\`** — Write a script or admin tool that Nick can run to perform this copy. All files, all subdirectories, everything. If you can do it directly, do it. If permissions are an issue, write a script Nick can run on the NAS.

2. **Rename `office-jobs` to `Data Sync` in the new location** — The folder `\\PS-NAS\DataSync\office-jobs\` should become `\\PS-NAS\DataSync\Data Sync\`.

3. **DO NOT touch the existing Docker container or anything in the original location.** The current live system stays running with zero changes. It is the fallback until the new one is confirmed working.

### Phase B: Full Audit — Read Everything, Trust Nothing
1. Read every single source code file in the codebase. All of them. Completely. Every line.
   - `server.js` (~1801 lines)
   - `public/app.js` (~1300 lines)
   - `docker-compose.yml`
   - `Dockerfile`
   - `package.json`
   - `config.js`
   - `notifier.js`
   - `logger.js`
   - Every Python script
   - Every file in the Android app source
   - `MainActivity.java` and `FileDownloadManager.java` especially
   - Everything else — if it's a code or config file, read it

2. Independently verify every claim in the Combined Assessment document against the actual source code. If something in the document is wrong, flag it.

3. Identify anything the previous sessions missed — endpoints, security issues, edge cases, race conditions, anything.

4. **Audit HiveMind's codebase** — This is critical. You need to understand:
   - How does HiveMind currently interface with Data Sync? Every touchpoint.
   - How does HiveMind access `events.jsonl`? Docker mount? SMB share? Direct filesystem?
   - Does HiveMind already have JXL/XML parsing logic? If so, how does it work?
   - Does HiveMind read files directly from the office-jobs (soon to be Data Sync) folder?
   - What paths does HiveMind reference that will change when we relocate?
   - Map absolutely everything.

5. **Check `MainActivity.java` for geolocation permissions** — Does the Android WebView have `onGeolocationPermissionsShowPrompt` overridden? Is `setGeolocationEnabled(true)` set? This matters for the forensics feature.

### Phase C: Report Findings — Do NOT Implement Yet
After your audit, report everything to Nick:

1. **Confirmation or corrections** of everything in the Combined Assessment
2. **How HiveMind interfaces with Data Sync** — complete map of every touchpoint
3. **How HiveMind handles JXL data** — does it already parse it? How?
4. **Recommendations** for the JXL parsing approach — should Data Sync parse it, should HiveMind parse it, or both? Pros and cons.
5. **Any new security vulnerabilities** you found that the previous sessions missed
6. **Any concerns** about the migration, the folder rename, path changes
7. **Complete implementation plan** covering all 9 features from the Combined Assessment, organized by phase, with:
   - Exact files to create/modify
   - Exact changes to make
   - Feature flags for everything
   - Concrete test plan for every feature (specific steps, expected results, pass/fail criteria)
   - Regression tests proving existing functionality still works after each change
8. **The forensics/fingerprinting design** — what's technically possible in this stack, what you recommend, how to implement it

### Phase D: After Nick Approves — Implement
Only after Nick reviews your findings and approves the plan do you implement anything. Nick may want to give your plan to yet another instance for independent review first.

### Phase E: After Implementation — Produce Handoff Documents
1. **HiveMind Handoff Document** — For every single change made to Data Sync, document:
   - What changed
   - What it's doing
   - Why it's doing it
   - The old way (exact old path/config/behavior)
   - The new way (exact new path/config/behavior)

   This gets given to a separate instance working on HiveMind. Zero surprises.

2. **Change Log** — A complete record of every file created, modified, or moved.

## Critical Rules
- **ZERO changes to the Android APK** — the app cannot be rebuilt
- **ALL changes must be purely additive** — no breaking existing functionality
- **Feature flags for everything** — system works identically with flags off
- **The existing Docker container stays running untouched** until the new one is confirmed
- **Do NOT implement JXL parsing** until you've audited HiveMind and reported findings to Nick
- **Everything must be tested, verified, and tested again** — no assumptions, prove it works
- **Be honest about gaps** — if you can't verify something, say so
- **Preserve all findings from previous sessions** — don't discard information, even corrections are valuable context

## Where Things Are
- **Combined Assessment**: `\\PS-NAS\Pardy Surveys\Data Sync\Chat History\Combined Assessment - All Sessions - 260208.md`
- **Previous chat histories**: `\\PS-NAS\Pardy Surveys\Data Sync\Chat History\` (Datasync 1, 2, 3 .txt files + markdown plan)
- **Current live codebase**: `\\PS-NAS\Pardy Surveys\Data Sync\trimble-sync\`
- **HiveMind**: Find it on the NAS — likely another Docker container under `/volume1/`
- **New location (to be created)**: `\\PS-NAS\DataSync\`
