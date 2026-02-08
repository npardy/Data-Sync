/**
 * In-memory upload progress tracking
 * Stores active upload status for status API queries
 *
 * NOTE: bytesReceived may be null during transfer with Multer.
 * Multer processes the entire multipart body before calling handlers,
 * so we only track start/completed events, not real-time byte progress.
 * The UI treats null bytesReceived as "unknown progress" gracefully.
 */

const config = require('./config');

// In-memory store (Map for better performance)
// In production with multiple instances, use Redis/Memcached
const progressStore = new Map();

/**
 * Update upload progress
 */
function updateProgress(uploadId, data) {
  if (!config.UPLOAD_PROGRESS_API) return;

  const existing = progressStore.get(uploadId) || {};

  progressStore.set(uploadId, {
    ...existing,
    ...data,
    lastUpdate: Date.now()
  });

  // Cleanup old entries (>1 hour) to prevent memory leak
  const now = Date.now();
  for (const [id, entry] of progressStore.entries()) {
    if (now - entry.lastUpdate > 3600000) {
      progressStore.delete(id);
    }
  }
}

/**
 * Get progress for specific upload
 */
function getProgress(uploadId) {
  if (!config.UPLOAD_PROGRESS_API) return null;
  return progressStore.get(uploadId) || null;
}

/**
 * List all active uploads (updated in last 5 minutes)
 */
function listActive() {
  if (!config.UPLOAD_PROGRESS_API) return [];

  const active = [];
  const now = Date.now();

  for (const [uploadId, data] of progressStore.entries()) {
    if (now - data.lastUpdate < 300000) { // Active in last 5 min
      active.push({ uploadId, ...data });
    }
  }

  // Sort by most recent first
  active.sort((a, b) => b.lastUpdate - a.lastUpdate);

  return active;
}

/**
 * Mark upload as completed
 */
function markCompleted(uploadId, result) {
  if (!config.UPLOAD_PROGRESS_API) return;

  const existing = progressStore.get(uploadId) || {};
  progressStore.set(uploadId, {
    ...existing,
    ...result,
    status: 'completed',
    completedAt: Date.now(),
    lastUpdate: Date.now()
  });
}

/**
 * Mark upload as failed
 */
function markFailed(uploadId, error) {
  if (!config.UPLOAD_PROGRESS_API) return;

  const existing = progressStore.get(uploadId) || {};
  progressStore.set(uploadId, {
    ...existing,
    status: 'failed',
    error: error,
    failedAt: Date.now(),
    lastUpdate: Date.now()
  });
}

/**
 * Delete old entries (cleanup job)
 */
function cleanup() {
  const now = Date.now();
  let deleted = 0;

  for (const [id, entry] of progressStore.entries()) {
    if (now - entry.lastUpdate > 3600000) { // >1 hour old
      progressStore.delete(id);
      deleted++;
    }
  }

  if (deleted > 0) {
    console.log(`Progress store cleanup: removed ${deleted} old entries`);
  }
}

// Run cleanup every 10 minutes
if (config.UPLOAD_PROGRESS_API) {
  setInterval(cleanup, 600000);
}

module.exports = {
  updateProgress,
  getProgress,
  listActive,
  markCompleted,
  markFailed
};
