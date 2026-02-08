/**
 * Idempotency store for detecting duplicate upload retries
 * Prevents re-processing identical uploads within TTL window
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

// Configurable via env, defaults to app root (container FS)
// For persistence across rebuilds, bind-mount a NAS volume and set env
const STORE_PATH = process.env.IDEMPOTENCY_STORE_PATH || path.join(__dirname, 'upload-idempotency.json');
const TTL_MS = 3600000; // 1 hour

console.log(`Idempotency store: ${STORE_PATH}`);

// In-memory cache + persistent JSON store
let idempotencyCache = {};
let isLoaded = false;

/**
 * Load store from disk
 */
async function loadStore() {
  if (isLoaded) return;

  try {
    const data = await fs.readFile(STORE_PATH, 'utf8');
    idempotencyCache = JSON.parse(data);
    isLoaded = true;

    // Cleanup expired entries on load
    cleanupExpired();
  } catch (error) {
    // File doesn't exist yet - start with empty cache
    idempotencyCache = {};
    isLoaded = true;
  }
}

/**
 * Save store to disk
 */
async function saveStore() {
  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(idempotencyCache, null, 2));
  } catch (error) {
    console.error('Failed to save idempotency store (non-critical):', error.message);
  }
}

/**
 * Generate idempotency key from upload metadata
 */
function generateKey(jobPath, files) {
  // Key = jobPath + sorted filenames + sizes
  const fileInfo = files
    .map(f => `${f.originalname}:${f.size}`)
    .sort()
    .join('|');

  const raw = `${jobPath}::${fileInfo}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Cleanup expired entries
 */
function cleanupExpired() {
  const now = Date.now();
  let deleted = 0;

  for (const key in idempotencyCache) {
    if (now - idempotencyCache[key].timestamp > TTL_MS) {
      delete idempotencyCache[key];
      deleted++;
    }
  }

  if (deleted > 0) {
    console.log(`Idempotency cleanup: removed ${deleted} expired entries`);
  }
}

/**
 * Check if upload is duplicate
 *
 * @param {string} jobPath - Job path
 * @param {Array} files - Array of file objects with originalname and size
 * @returns {Promise<Object|null>} Previous result if duplicate, null otherwise
 */
async function checkDuplicate(jobPath, files) {
  if (!config.UPLOAD_IDEMPOTENCY_ENABLED) return null;

  await loadStore();

  const key = generateKey(jobPath, files);
  const entry = idempotencyCache[key];

  if (entry && (Date.now() - entry.timestamp < TTL_MS)) {
    console.log(`Duplicate upload detected: ${jobPath} (key: ${key})`);
    return entry.result; // Return cached result
  }

  return null;
}

/**
 * Store successful upload result
 *
 * @param {string} jobPath - Job path
 * @param {Array} files - Array of file objects
 * @param {Object} result - Upload result to cache
 */
async function storeResult(jobPath, files, result) {
  if (!config.UPLOAD_IDEMPOTENCY_ENABLED) return;

  await loadStore();

  const key = generateKey(jobPath, files);
  idempotencyCache[key] = {
    timestamp: Date.now(),
    result
  };

  // Cleanup old entries
  cleanupExpired();

  // Persist to disk (async, non-blocking)
  saveStore().catch(() => {});
}

/**
 * Clear all entries (for testing)
 */
async function clear() {
  idempotencyCache = {};
  await saveStore();
}

// Periodic cleanup (every 10 minutes)
if (config.UPLOAD_IDEMPOTENCY_ENABLED) {
  setInterval(() => {
    cleanupExpired();
    saveStore().catch(() => {});
  }, 600000);
}

module.exports = {
  checkDuplicate,
  storeResult,
  clear
};
