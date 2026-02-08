const fs = require('fs').promises;
const path = require('path');

// Log file path
const LOG_FILE = path.join(__dirname, 'sync-activity.log');

/**
 * Lightweight logging utility for Data Sync operations
 * Logs are appended to sync-activity.log with timestamps
 *
 * SECURITY: Log Redaction Policy
 * - NEVER log raw form field values or file contents
 * - ONLY log: filenames, sizes (bytes), paths, durations, status codes
 * - Keep all PII/sensitive data out of logs
 * - This policy applies to all logger functions below
 */

// Format timestamp for logs
function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// Write log entry to file (fail-safe - never throws)
async function writeLog(message) {
    try {
        const logEntry = `[${getTimestamp()}] ${message}\n`;
        await fs.appendFile(LOG_FILE, logEntry, 'utf8');
    } catch (error) {
        // Fail silently - logging errors should never impact app operation
        console.error('Log write failed (non-critical):', error.message);
    }
}

// Public logging functions
const logger = {
    // Controller opened the app
    controllerOpened: async () => {
        await writeLog('Controller opened data sync.');
    },

    // Controller clicked upload button
    uploadClicked: async (jobPath = '') => {
        const detail = jobPath ? ` (${jobPath})` : '';
        await writeLog(`Controller clicked upload${detail}.`);
    },

    // Controller clicked download button
    downloadClicked: async (jobPath = '') => {
        const detail = jobPath ? ` (${jobPath})` : '';
        await writeLog(`Controller clicked download${detail}.`);
    },

    // Controller initiated connection (handshake)
    handshake: async (endpoint = '') => {
        const detail = endpoint ? ` to ${endpoint}` : '';
        await writeLog(`Controller handshake initiated${detail}.`);
    },

    // Upload attempt failed (enhanced with uploadId)
    uploadFailed: async (reason = 'Unknown error', jobPath = '', uploadId = '') => {
        const detail = jobPath ? ` (${jobPath})` : '';
        const id = uploadId ? ` [ID: ${uploadId}]` : '';
        await writeLog(`File upload attempted but failed${detail}${id}: ${reason}`);
    },

    // Upload started (NEW)
    uploadStarted: async (jobPath, fileCount, uploadId) => {
        await writeLog(`Upload started: ${jobPath} - ${fileCount} file(s) [ID: ${uploadId}]`);
    },

    // File completed within upload (NEW)
    uploadFileCompleted: async (filename, size, uploadId) => {
        const sizeMB = (size / 1048576).toFixed(2);
        await writeLog(`  File uploaded: ${filename} (${sizeMB} MB) [ID: ${uploadId}]`);
    },

    // Upload completed (NEW)
    uploadCompleted: async (jobPath, fileCount, totalBytes, durationMs, uploadId) => {
        const durationSec = (durationMs / 1000).toFixed(1);
        const totalMB = (totalBytes / 1048576).toFixed(2);
        const speedKBps = ((totalBytes / 1024) / (durationMs / 1000)).toFixed(1);
        await writeLog(`Upload completed: ${jobPath} - ${fileCount} file(s), ${totalMB} MB in ${durationSec}s (${speedKBps} KB/s) [ID: ${uploadId}]`);
    },

    // New job or folder created (real state change)
    resourceCreated: async (type, name) => {
        await writeLog(`${type} created: ${name}`);
    },

    // Generic log entry
    log: async (message) => {
        await writeLog(message);
    }
};

module.exports = logger;
