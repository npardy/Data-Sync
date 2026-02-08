/**
 * File checksum utilities for integrity verification
 * Uses MD5 for fast computation (not cryptographic security)
 */

const crypto = require('crypto');
const fs = require('fs');
const { pipeline } = require('stream/promises');

/**
 * Compute MD5 checksum of file (streaming, memory-efficient)
 *
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} Hex-encoded MD5 hash
 */
async function computeChecksum(filePath) {
  const hash = crypto.createHash('md5');
  const stream = fs.createReadStream(filePath);

  try {
    await pipeline(stream, hash);
    return hash.digest('hex');
  } catch (error) {
    console.error('Checksum computation failed:', error);
    throw error;
  }
}

/**
 * Compute checksums for multiple files
 *
 * @param {Array<{name: string, path: string}>} files - Array of file objects
 * @returns {Promise<Array<{name: string, checksum: string}>>}
 */
async function computeChecksums(files) {
  const results = [];

  for (const file of files) {
    try {
      const checksum = await computeChecksum(file.path);
      results.push({
        name: file.name,
        checksum
      });
    } catch (error) {
      console.error(`Failed to checksum ${file.name}:`, error.message);
      results.push({
        name: file.name,
        checksum: null,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Verify file matches expected checksum
 *
 * @param {string} filePath - Path to file
 * @param {string} expectedChecksum - Expected MD5 hash
 * @returns {Promise<boolean>}
 */
async function verifyChecksum(filePath, expectedChecksum) {
  try {
    const actualChecksum = await computeChecksum(filePath);
    return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
  } catch (error) {
    return false;
  }
}

module.exports = {
  computeChecksum,
  computeChecksums,
  verifyChecksum
};
