/**
 * Streaming upload handler with disk storage
 * Replaces multer.memoryStorage() to prevent RAM exhaustion
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const config = require('./config');

// Configurable file size limit (MB)
const FILE_SIZE_MB = parseInt(process.env.UPLOAD_MAX_FILE_MB || '100', 10);
const FILE_SIZE_BYTES = FILE_SIZE_MB * 1024 * 1024;

console.log(`Upload file size limit: ${FILE_SIZE_MB} MB`);

/**
 * Ensure upload directories exist
 */
async function ensureUploadDirs() {
  await fs.mkdir(config.UPLOAD_TEMP_DIR, { recursive: true });
  if (config.UPLOAD_RESUME_ENABLED) {
    await fs.mkdir(config.UPLOAD_PARTIAL_DIR, { recursive: true });
  }
}

/**
 * Streaming disk storage configuration
 */
const streamingStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureUploadDirs();

      // Generate unique upload ID (reuse if already set)
      if (!req.uploadId) {
        req.uploadId = crypto.randomUUID();
      }

      // Create temp directory for this upload
      const tempDir = path.join(config.UPLOAD_TEMP_DIR, req.uploadId);
      await fs.mkdir(tempDir, { recursive: true });

      cb(null, tempDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Use original filename (sanitized by multer)
    cb(null, file.originalname);
  }
});

/**
 * Multer instance with streaming enabled (if flag set)
 */
const streamingUpload = multer({
  storage: streamingStorage,
  limits: {
    fileSize: FILE_SIZE_BYTES
  }
});

/**
 * Legacy memory-based upload (for backward compatibility)
 */
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_SIZE_BYTES
  }
});

/**
 * Get the appropriate multer instance based on config
 */
function getUpload() {
  return config.UPLOAD_STREAMING_ENABLED ? streamingUpload : memoryUpload;
}

/**
 * Cleanup temp directory after successful upload
 */
async function cleanupTempDir(uploadId) {
  if (!config.UPLOAD_STREAMING_ENABLED) return;

  try {
    const tempDir = path.join(config.UPLOAD_TEMP_DIR, uploadId);
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Fail silently - temp cleanup is non-critical
    console.error('Temp cleanup failed (non-critical):', error.message);
  }
}

module.exports = {
  getUpload,
  streamingUpload,
  memoryUpload,
  cleanupTempDir,
  ensureUploadDirs
};
