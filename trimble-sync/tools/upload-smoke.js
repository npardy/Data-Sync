#!/usr/bin/env node

/**
 * Smoke test for upload endpoints
 * Tests file uploads and verifies logging, progress API, and completion
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const LOG_FILE = path.join(__dirname, '..', 'sync-activity.log');
const PROGRESS_API_ENABLED = process.env.UPLOAD_PROGRESS_API === 'true';

let testsPassed = 0;
let testsFailed = 0;

// Color codes for terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function pass(message) {
  testsPassed++;
  log(`✓ ${message}`, 'green');
}

function fail(message) {
  testsFailed++;
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'cyan');
}

// Create test file
function createTestFile(name, sizeKB) {
  const filePath = path.join(__dirname, name);
  const buffer = Buffer.alloc(sizeKB * 1024, 'X');
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// HTTP POST with form data
function httpPost(url, formData) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      headers: formData.getHeaders()
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    formData.pipe(req);
  });
}

// HTTP GET
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    }).on('error', reject);
  });
}

// Wait for condition
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check log file for expected entries
function checkLogEntries(uploadId, expectedEntries) {
  try {
    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    const logLines = logContent.split('\n');

    for (const expected of expectedEntries) {
      const found = logLines.some(line =>
        line.includes(uploadId) && line.includes(expected)
      );

      if (found) {
        pass(`Log contains: "${expected}"`);
      } else {
        fail(`Log missing: "${expected}"`);
      }
    }
  } catch (error) {
    fail(`Failed to read log file: ${error.message}`);
  }
}

// Main test suite
async function runTests() {
  log('\n=================================================', 'cyan');
  log('   TRIMBLE SYNC - UPLOAD SMOKE TESTS', 'cyan');
  log('=================================================\n', 'cyan');

  info(`Server: ${SERVER_URL}`);
  info(`Progress API: ${PROGRESS_API_ENABLED ? 'Enabled' : 'Disabled'}\n`);

  // Test 1: Health check
  try {
    info('Test 1: Health check...');
    const health = await httpGet(`${SERVER_URL}/health`);
    if (health.body.status === 'ok') {
      pass('Server is healthy');
    } else {
      fail('Server health check failed');
    }
  } catch (error) {
    fail(`Health check failed: ${error.message}`);
    log('\n⚠️  Server not running or unreachable. Exiting.\n', 'red');
    process.exit(1);
  }

  // Test 2: Small file upload (2 MB)
  try {
    info('\nTest 2: Upload small file (2 MB)...');
    const smallFile = createTestFile('test-small.bin', 2048);

    const formData = new FormData();
    formData.append('jobPath', 'test-job/25-100');
    formData.append('files', fs.createReadStream(smallFile), {
      filename: 'test-small.bin',
      contentType: 'application/octet-stream'
    });

    const startTime = Date.now();
    const response = await httpPost(`${SERVER_URL}/api/upload-field-data-android`, formData);
    const duration = Date.now() - startTime;

    if (response.body.success) {
      pass(`Upload succeeded in ${duration}ms`);
      pass(`Upload ID: ${response.body.uploadId}`);

      const uploadId = response.body.uploadId;

      // Wait for logs to flush
      await wait(500);

      // Check log entries
      info('  Checking log entries...');
      checkLogEntries(uploadId, [
        'Upload started',
        'File uploaded',
        'Upload completed'
      ]);

      // Check progress API if enabled
      if (PROGRESS_API_ENABLED) {
        info('  Checking progress API...');
        await wait(500);
        const progress = await httpGet(`${SERVER_URL}/api/upload-status/${uploadId}`);

        if (progress.body.status === 'ok' || progress.body.status === 'not_found') {
          pass('Progress API accessible');
        } else {
          fail('Progress API returned unexpected status');
        }
      }
    } else {
      fail('Upload failed');
    }

    // Cleanup
    fs.unlinkSync(smallFile);
  } catch (error) {
    fail(`Small file upload failed: ${error.message}`);
  }

  // Test 3: Medium file upload (10 MB)
  try {
    info('\nTest 3: Upload medium file (10 MB)...');
    const mediumFile = createTestFile('test-medium.bin', 10240);

    const formData = new FormData();
    formData.append('jobPath', 'test-job/25-200');
    formData.append('files', fs.createReadStream(mediumFile), {
      filename: 'test-medium.bin',
      contentType: 'application/octet-stream'
    });

    const startTime = Date.now();
    const response = await httpPost(`${SERVER_URL}/api/upload-field-data-android`, formData);
    const duration = Date.now() - startTime;

    if (response.body.success) {
      pass(`Upload succeeded in ${duration}ms`);

      const speedMBps = ((10 * 1024 * 1024) / (duration / 1000) / (1024 * 1024)).toFixed(2);
      info(`  Upload speed: ${speedMBps} MB/s`);

      // Check that bytes match
      if (response.body.totalBytes === 10 * 1024 * 1024) {
        pass('Total bytes match expected size');
      } else {
        fail(`Byte mismatch: expected ${10 * 1024 * 1024}, got ${response.body.totalBytes}`);
      }
    } else {
      fail('Upload failed');
    }

    // Cleanup
    fs.unlinkSync(mediumFile);
  } catch (error) {
    fail(`Medium file upload failed: ${error.message}`);
  }

  // Test 4: Multi-file upload
  try {
    info('\nTest 4: Upload multiple files...');
    const file1 = createTestFile('test-multi-1.bin', 512);
    const file2 = createTestFile('test-multi-2.bin', 1024);
    const file3 = createTestFile('test-multi-3.bin', 256);

    const formData = new FormData();
    formData.append('jobPath', 'test-job/25-300');
    formData.append('files', fs.createReadStream(file1), { filename: 'test-multi-1.bin' });
    formData.append('files', fs.createReadStream(file2), { filename: 'test-multi-2.bin' });
    formData.append('files', fs.createReadStream(file3), { filename: 'test-multi-3.bin' });

    const response = await httpPost(`${SERVER_URL}/api/upload-field-data-android`, formData);

    if (response.body.success && response.body.filesUploaded === 3) {
      pass('Multi-file upload succeeded (3 files)');
    } else {
      fail(`Multi-file upload failed or wrong count: ${response.body.filesUploaded}`);
    }

    // Cleanup
    fs.unlinkSync(file1);
    fs.unlinkSync(file2);
    fs.unlinkSync(file3);
  } catch (error) {
    fail(`Multi-file upload failed: ${error.message}`);
  }

  // Test 5: Progress API listing (if enabled)
  if (PROGRESS_API_ENABLED) {
    try {
      info('\nTest 5: List active uploads...');
      const list = await httpGet(`${SERVER_URL}/api/upload-status`);

      if (Array.isArray(list.body.active)) {
        pass(`Progress API returned ${list.body.active.length} upload(s)`);
      } else {
        fail('Progress API did not return active array');
      }
    } catch (error) {
      fail(`Progress API list failed: ${error.message}`);
    }
  } else {
    info('\nTest 5: Progress API skipped (disabled)');
  }

  // Summary
  log('\n=================================================', 'cyan');
  log('   TEST SUMMARY', 'cyan');
  log('=================================================\n', 'cyan');

  const total = testsPassed + testsFailed;
  log(`Total tests: ${total}`, 'cyan');
  log(`Passed: ${testsPassed}`, 'green');
  log(`Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');

  if (testsFailed === 0) {
    log('\n✅ ALL TESTS PASSED\n', 'green');
    process.exit(0);
  } else {
    log('\n❌ SOME TESTS FAILED\n', 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}\n`, 'red');
  process.exit(1);
});
