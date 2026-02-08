const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const xml2js = require('xml2js');
const { spawn } = require('child_process');
const archiver = require('archiver');
const crypto = require('crypto');
const logger = require('./logger');

// Upload resilience modules (feature-flagged)
const config = require('./config');
const { getUpload, cleanupTempDir } = require('./uploadHandler');
const progressStore = require('./progressStore');
const { computeChecksum } = require('./checksumUtil');
const idempotencyStore = require('./idempotencyStore');
const { queueNotification } = require('./notifier');

// In-memory store for pending field status (before upload)
const pendingFieldStatus = new Map();

const app = express();
const PORT = parseInt(process.env.PORT) || 3000;

// Configuration for Synology NAS paths - REVERTED TO ORIGINAL
const CONFIG = {
  OFFICE_ROOT: '/data/office',
  CONTROLLER_ROOT: '/data/controller',
  TEMPLATES_DIR: '/data/templates'
};

console.log('Server starting with config:', CONFIG);

/**
 * Parse CSV file and extract survey point data based on feature codes
 * @param {string} csvContent - The CSV file content as a string
 * @returns {object} Extracted data with counts and arrays
 */
function parseCSVForFeatureCodes(csvContent) {
  const result = {
    total_points: 0,
    evidence_found: [],      // FIP*, FIB* - store as "pointID - code"
    pins_placed: [],         // CIP*, PIP* - store as "pointID - code"
    evidence_not_found: 0,   // PNF - count only
    evidence_to_find: 0,     // FIND* - count only
    monument_checks: []      // *-CKS - store monument numbers
  };

  try {
    const lines = csvContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Split by comma
      const columns = line.split(',');

      // Need at least 5 columns (Point_ID, Northing, Easting, Elevation, Feature_Code)
      if (columns.length < 5) continue;

      const pointID = columns[0].trim();
      const featureCodeColumn = columns[4].trim();

      if (!pointID || !featureCodeColumn) continue;

      result.total_points++;

      // Feature codes can be space-separated in the 5th column
      const featureCodes = featureCodeColumn.split(/\s+/);

      for (const code of featureCodes) {
        if (!code) continue;

        // Evidence Found: starts with FIP or FIB
        if (code.startsWith('FIP') || code.startsWith('FIB')) {
          result.evidence_found.push(`${pointID} - ${code}`);
        }
        // Pins Placed: starts with CIP or PIP
        else if (code.startsWith('CIP') || code.startsWith('PIP')) {
          result.pins_placed.push(`${pointID} - ${code}`);
        }
        // Evidence Not Found: exactly "PNF"
        else if (code === 'PNF') {
          result.evidence_not_found++;
        }
        // Evidence To Find: starts with "FIND"
        else if (code.startsWith('FIND')) {
          result.evidence_to_find++;
        }
        // Monument Checks: ends with "-CKS"
        else if (code.endsWith('-CKS')) {
          const monumentNum = code.substring(0, code.length - 4);
          if (monumentNum && !result.monument_checks.includes(monumentNum)) {
            result.monument_checks.push(monumentNum);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing CSV:', error);
    // Return empty result on error
  }

  return result;
}

/**
 * Find and parse CSV file from uploaded files
 * @param {string} uploadPath - Path to the upload folder
 * @returns {object|null} Parsed CSV data or null if no CSV found
 */
async function extractCSVData(uploadPath) {
  try {
    const files = await fs.readdir(uploadPath);

    // Find CSV file (exclude Layout and Control files)
    const csvFile = files.find(f =>
      f.toLowerCase().endsWith('.csv') &&
      !f.toLowerCase().includes('layout') &&
      !f.toLowerCase().includes('control')
    );

    if (!csvFile) {
      console.log('No suitable CSV file found in upload');
      return null;
    }

    console.log(`Found CSV file: ${csvFile}`);
    const csvPath = path.join(uploadPath, csvFile);
    const csvContent = await fs.readFile(csvPath, 'utf8');

    return parseCSVForFeatureCodes(csvContent);
  } catch (error) {
    console.error('Error extracting CSV data:', error);
    return null;
  }
}

// Middleware - CORS with domain restriction
// Allow local network and DDNS access only (or use explicit allowlist if set)
const corsOptions = config.CORS_ALLOW_ORIGINS
  ? {
      // Explicit allowlist mode (from env var)
      origin: config.CORS_ALLOW_ORIGINS,
      credentials: true
    }
  : {
      // Default pattern-based mode
      origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, curl, etc.)
        if (!origin) return callback(null, true);

        // Allow localhost and LAN (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        const localPatterns = [
          /^http:\/\/localhost(:\d+)?$/,
          /^http:\/\/127\.0\.0\.1(:\d+)?$/,
          /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
          /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
          /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/
        ];

        // Allow Synology DDNS domains (*.synology.me, *.myds.me, *.direct.quickconnect.to)
        const ddnsPatterns = [
          /^https?:\/\/[\w-]+\.synology\.me(:\d+)?$/,
          /^https?:\/\/[\w-]+\.myds\.me(:\d+)?$/,
          /^https?:\/\/[\w-]+\.direct\.quickconnect\.to(:\d+)?$/
        ];

        const allowed = [...localPatterns, ...ddnsPatterns].some(pattern => pattern.test(origin));

        if (allowed) {
          callback(null, true);
        } else {
          console.warn(`CORS blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    };

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files (upload-status.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// LEGACY HOST REDIRECT MIDDLEWARE (Feature-Flagged)
// ============================================================

/**
 * IMPORTANT LIMITATION: This redirect only works when the incoming Host header
 * resolves to this server (e.g., pardysurveys.synology.me or your own domain).
 *
 * It DOES NOT affect traffic going through Synology QuickConnect relays
 * (e.g., *.direct.quickconnect.to) unless DNS for that host is under your control.
 * QuickConnect's relay terminates TLS on Synology's network and won't forward
 * requests with that Host header to your server.
 *
 * Use cases:
 * - Future hostname migrations (myoldname.synology.me → mynewname.synology.me)
 * - Custom domain transitions (old.example.com → new.example.com)
 * - NOT for migrating controllers away from QuickConnect without an APK update
 *
 * Preserves POST method/body via 308 Permanent Redirect (RFC 7538).
 * OkHttp follows 308 automatically with method/body intact.
 */
if (config.HOST_REDIRECTS_ENABLED) {
  app.use((req, res, next) => {
    // Only redirect API routes (never static files)
    if (!req.path.startsWith('/api/')) {
      return next();
    }

    // Check X-Forwarded-Host first (reverse proxies), then Host header
    const requestHost = (req.get('x-forwarded-host') || req.get('host') || '').toLowerCase();
    const targetHost = config.HOST_REDIRECTS_TARGET_HOST.toLowerCase();

    // Skip if already using target host (prevent loops)
    if (requestHost === targetHost || requestHost === `${targetHost}:${PORT}`) {
      return next();
    }

    // Check if request is from legacy host
    const isLegacyHost = config.HOST_REDIRECTS_LEGACY_HOSTS.some(
      legacy => requestHost === legacy || requestHost.startsWith(`${legacy}:`)
    );

    if (isLegacyHost) {
      const targetUrl = `${config.HOST_REDIRECTS_TARGET_PROTO}://${targetHost}${req.originalUrl}`;

      // Log what the proxy/client presented (X-Forwarded-Host takes precedence)
      const presentedHost = req.get('x-forwarded-host') || req.get('host');
      console.log(`[308 Redirect] ${presentedHost} → ${targetHost}${req.path}`);

      // 308 Permanent Redirect (preserves POST method/body)
      // Headers only, no JSON body (some clients mishandle it)
      return res.status(308)
        .set('Location', targetUrl)
        .set('Cache-Control', 'no-store')
        .set('Retry-After', '0')
        .end();
    }

    next();
  });

  console.log(`Host redirects ENABLED: ${config.HOST_REDIRECTS_LEGACY_HOSTS.join(', ')} → ${config.HOST_REDIRECTS_TARGET_HOST}`);
}

// Helper: Detect if request is from controller (Android app)
function isControllerRequest(req) {
  const userAgent = req.get('User-Agent') || '';
  const origin = req.get('Origin') || '';
  // Android WebView typically includes specific markers
  return userAgent.includes('Android') ||
         userAgent.includes('TrimbleSync') ||
         origin.includes('android');
}

/**
 * Security: Validate path doesn't escape root directory
 * Prevents path traversal attacks (../ exploits)
 * @param {string} rootDir - Base directory (e.g., CONFIG.OFFICE_ROOT)
 * @param {string} userPath - User-supplied path component
 * @returns {string|null} - Resolved safe path or null if invalid
 */
function validatePath(rootDir, userPath) {
  const resolved = path.resolve(rootDir, userPath);
  const normalizedRoot = path.resolve(rootDir) + path.sep;

  if (!resolved.startsWith(normalizedRoot) && resolved !== path.resolve(rootDir)) {
    return null; // Path escapes root
  }

  return resolved;
}

// Middleware: Log handshakes from controller on specific endpoints
app.use((req, res, next) => {
  if (isControllerRequest(req)) {
    // Only log API calls, not static file requests
    if (req.path.startsWith('/api/')) {
      logger.handshake(req.path);
    }
  }
  next();
});

// ============================================================
// OAuth Callback for QuickBooks Online
// Used by Email Automation system to authenticate with QBO
// ============================================================
app.get('/oauth/callback', (req, res) => {
  const { code, realmId, state, error } = req.query;
  
  if (error) {
    console.log('[OAuth] Error:', error);
    return res.send(`
      <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #d32f2f;">❌ Authorization Failed</h1>
        <p>Error: ${error}</p>
        <p>${req.query.error_description || ''}</p>
      </body>
      </html>
    `);
  }
  
  if (code && realmId) {
    console.log('[OAuth] Success - Code received for realm:', realmId);
    return res.send(`
      <html>
      <head><title>OAuth Success</title></head>
      <body style="font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2e7d32;">✅ QuickBooks Authorization Successful!</h1>
        <p>Copy these values to complete authentication:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Authorization Code:</strong></p>
          <textarea id="code" readonly style="width: 100%; height: 60px; font-family: monospace; font-size: 12px;">${code}</textarea>
          <p style="margin-top: 15px;"><strong>Realm ID (Company ID):</strong></p>
          <input id="realm" type="text" readonly value="${realmId}" style="width: 100%; padding: 8px; font-family: monospace;">
        </div>
        <p style="color: #666; font-size: 14px;">You can close this window after copying the values.</p>
        <script>
          // Auto-select code on click
          document.getElementById('code').onclick = function() { this.select(); };
          document.getElementById('realm').onclick = function() { this.select(); };
        </script>
      </body>
      </html>
    `);
  }
  
  res.send(`
    <html>
    <head><title>OAuth Callback</title></head>
    <body style="font-family: Arial, sans-serif; padding: 40px;">
      <h1>OAuth Callback</h1>
      <p>No authorization code received.</p>
      <p>Query params: ${JSON.stringify(req.query)}</p>
    </body>
    </html>
  `);
});

// Multer setup for file uploads - toggles between memory and disk streaming
// Based on UPLOAD_STREAMING_ENABLED flag
const upload = getUpload();
const fieldDataUpload = getUpload();

console.log('Upload mode:', config.UPLOAD_STREAMING_ENABLED ? 'STREAMING (disk)' : 'LEGACY (memory)');

// Delete files or folders
app.post('/api/delete', async (req, res) => {
  console.log('Delete request:', req.body);
  try {
    const { folder, files } = req.body;

    if (folder) {
      // Delete folder
      const folderPath = path.join(CONFIG.OFFICE_ROOT, folder);
      console.log('Deleting folder:', folderPath);

      // Check if this looks like a job folder (e.g., "2026/26-001 - 123 Main St")
      const jobMatch = folder.match(/(\d{2}-\d{3})\s*-\s*(.+)$/);

      await fs.rm(folderPath, { recursive: true, force: true });

      // Notify Hive Mind if a job folder was deleted
      if (jobMatch) {
        const jobNumber = jobMatch[1];
        const jobName = jobMatch[2];
        await queueNotification('job_deleted', {
          job_number: jobNumber,
          job_name: jobName,
          folder_path: folder,
          deleted_at: new Date().toISOString()
        });
      }
    } else if (files && files.length > 0) {
      // Delete files
      for (const file of files) {
        const filePath = path.join(CONFIG.OFFICE_ROOT, file);
        console.log('Deleting file:', filePath);
        await fs.unlink(filePath);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create folder (works at any level)
app.post('/api/create-main-folder', async (req, res) => {
  try {
    const { folderName, parentPath, location } = req.body;
    const root = location === 'controller' ? CONFIG.CONTROLLER_ROOT : CONFIG.OFFICE_ROOT;

    // Build the full path
    const folderPath = parentPath
      ? path.join(root, parentPath, folderName)
      : path.join(root, folderName);

    await fs.mkdir(folderPath, { recursive: true });

    // Verify it was created
    try {
      await fs.access(folderPath);
      // Log actual state change (real folder creation, not refresh)
      const displayPath = parentPath ? `${parentPath}/${folderName}` : folderName;
      await logger.resourceCreated('Folder', displayPath);
    } catch (e) {
      console.error('Failed to verify folder creation:', e);
    }

    res.json({ success: true, path: folderPath });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new job
app.post('/api/create-job', async (req, res) => {
  try {
    const { parentPath, jobNumber, date, address, jobType, template, referenceNumber, description, operator } = req.body;

    if (!parentPath || !jobNumber || !date || !address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create job folder name without description
    const jobFolderName = `${jobNumber}-${date}`;
    const jobPath = path.join(CONFIG.OFFICE_ROOT, parentPath, jobFolderName);

    // Create folder
    await fs.mkdir(jobPath, { recursive: true });

    // Save job metadata
    const metadataPath = path.join(jobPath, 'job_info.json');
    const metadata = {
      jobNumber,
      date,
      address,
      jobType: jobType || 'survey_rpr',
      referenceNumber: referenceNumber || '',
      description: description || '',
      operator: operator || '',
      created: new Date().toISOString()
    };
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Log actual job creation (real state change, not refresh)
    await logger.resourceCreated('Job', `${parentPath}/${jobFolderName}`);

    // Notify Hive Mind of layout job creation
    await queueNotification('layout_job_created', {
      job_number: jobNumber,
      address,
      operator: operator || null,
      folder_path: `${parentPath}/${jobFolderName}`,
      job_folder: jobFolderName,
      job_type: jobType || 'survey_rpr',
      reference_number: referenceNumber || null,
      created: new Date().toISOString()
    });

    // Copy template files if specified
    if (template) {
      const templatePath = path.join(CONFIG.TEMPLATES_DIR, template);
      try {
        const templateFiles = await fs.readdir(templatePath);

        for (const file of templateFiles) {
          const sourcePath = path.join(templatePath, file);
          const stats = await fs.stat(sourcePath);

          if (stats.isFile()) {
            let destFileName = file;

            // If it's a JXL file, rename it to match the full job name
            if (file.endsWith('.jxl')) {
              // Parse and modify JXL
              const jxlContent = await fs.readFile(sourcePath, 'utf8');
              const parser = new xml2js.Parser();
              const builder = new xml2js.Builder();

              try {
                const jxlData = await parser.parseStringPromise(jxlContent);

                // Update job name and timestamp
                if (jxlData.JOBFile && jxlData.JOBFile.$) {
                  jxlData.JOBFile.$.jobName = jobFolderName; // Use full job folder name
                  jxlData.JOBFile.$.TimeStamp = new Date().toISOString();
                }

                // Add job note with address
                if (jxlData.JOBFile?.Environment?.[0]?.JobProperties?.[0]) {
                  jxlData.JOBFile.Environment[0].JobProperties[0].JobNote = address;
                }

                // Save customized JXL with full job name
                const modifiedJxl = builder.buildObject(jxlData);
                destFileName = `${jobFolderName}.jxl`;
                await fs.writeFile(path.join(jobPath, destFileName), modifiedJxl);
              } catch (e) {
                // If XML parsing fails, just copy as-is with renamed file
                destFileName = `${jobFolderName}.jxl`;
                await fs.copyFile(sourcePath, path.join(jobPath, destFileName));
              }
            }
            // If it's a control CSV, rename it with date
            else if (file.toLowerCase().includes('control') && file.endsWith('.csv')) {
              destFileName = `Control - Avalon - ${date}.csv`;
              await fs.copyFile(sourcePath, path.join(jobPath, destFileName));
            }
            // Copy other files as-is
            else {
              await fs.copyFile(sourcePath, path.join(jobPath, destFileName));
            }
          }
        }
      } catch (e) {
        console.error('Error copying template files:', e.message);
      }
    }
    
    res.json({ 
      success: true, 
      path: jobPath,
      jobFolder: jobFolderName
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available templates
app.get('/api/templates', async (req, res) => {
  try {
    const templates = [];
    const items = await fs.readdir(CONFIG.TEMPLATES_DIR, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const templatePath = path.join(CONFIG.TEMPLATES_DIR, item.name);
        const files = await fs.readdir(templatePath);
        templates.push({
          name: item.name,
          files: files.filter(f => f.endsWith('.jxl') || f.endsWith('.csv') || f.endsWith('.CSV'))
        });
      }
    }

    res.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.json([]);
  }
});

// Get folder structure
app.get('/api/folders', async (req, res) => {
  try {
    // Removed verbose logging on every refresh - was creating noise
    const structure = await buildFolderTree(CONFIG.OFFICE_ROOT);
    const controllerStructure = await buildFolderTree(CONFIG.CONTROLLER_ROOT);

    res.json({
      office: structure,
      controller: controllerStructure
    });
  } catch (error) {
    console.error('Error getting folders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload files
app.post('/api/upload', upload.array('files'), async (req, res) => {
  const uploadId = req.uploadId || crypto.randomUUID();
  const uploadStart = Date.now();

  try {
    const targetPath = req.body.targetPath || '';

    // Security: Validate path doesn't escape office root
    const uploadPath = validatePath(CONFIG.OFFICE_ROOT, targetPath);
    if (!uploadPath) {
      await logger.uploadFailed('Invalid path: traversal attempt blocked', targetPath, uploadId);
      return res.status(400).json({ error: 'Invalid path' });
    }

    // Log start and update progress
    await logger.uploadStarted(targetPath, req.files.length, uploadId);
    progressStore.updateProgress(uploadId, {
      jobPath: targetPath,
      fileCount: req.files.length,
      status: 'started',
      startTime: uploadStart
    });

    // Create directory if it doesn't exist
    await fs.mkdir(uploadPath, { recursive: true });

    // Save files (method depends on streaming mode)
    const uploadedFiles = [];
    let totalBytes = 0;

    for (const file of req.files) {
      const destPath = path.join(uploadPath, file.originalname);

      if (config.UPLOAD_STREAMING_ENABLED) {
        // File already on disk in temp location - move it atomically
        await fs.rename(file.path, destPath);
      } else {
        // Legacy: write from memory buffer
        await fs.writeFile(destPath, file.buffer);
      }

      uploadedFiles.push(file.originalname);
      totalBytes += file.size;
      await logger.uploadFileCompleted(file.originalname, file.size, uploadId);
    }

    const durationMs = Date.now() - uploadStart;
    await logger.uploadCompleted(targetPath, req.files.length, totalBytes, durationMs, uploadId);
    progressStore.markCompleted(uploadId, { fileCount: req.files.length, totalBytes, durationMs });

    res.json({ success: true, files: uploadedFiles, uploadId, totalBytes, durationMs });
  } catch (error) {
    console.error('Upload error:', error);
    await logger.uploadFailed(error.message, req.body.targetPath || '', uploadId);
    progressStore.markFailed(uploadId, error.message);
    res.status(500).json({ error: error.message });
  } finally {
    // Always cleanup temp directory if streaming
    if (config.UPLOAD_STREAMING_ENABLED) {
      await cleanupTempDir(uploadId);
    }
  }
});

// Store pending field status before upload (called from web UI)
app.post('/api/store-pending-field-status', express.json(), async (req, res) => {
  try {
    const { jobPath, fieldStatus } = req.body;

    if (!jobPath || !fieldStatus) {
      return res.status(400).json({ error: 'jobPath and fieldStatus are required' });
    }

    // Store the field status keyed by jobPath
    pendingFieldStatus.set(jobPath, {
      data: fieldStatus,
      timestamp: Date.now()
    });

    console.log(`Stored pending field status for job: ${jobPath}`);

    // Auto-cleanup after 5 minutes (in case upload never happens)
    setTimeout(() => {
      if (pendingFieldStatus.has(jobPath)) {
        console.log(`Auto-cleaning stale field status for: ${jobPath}`);
        pendingFieldStatus.delete(jobPath);
      }
    }, 5 * 60 * 1000);

    res.json({ success: true });
  } catch (error) {
    console.error('Error storing field status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload field data from TSC5 - creates field-data subfolder
app.post('/api/upload-field-data', fieldDataUpload.array('files'), async (req, res) => {
  const uploadId = req.uploadId || crypto.randomUUID();
  const uploadStart = Date.now();

  try {
    const { jobPath } = req.body;
    if (!jobPath) {
      await logger.uploadFailed('No job path provided', '', uploadId);
      return res.status(400).json({ error: 'Job path required' });
    }

    // Create timestamp for folder name in format YYMMDD-HHMMAM
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = String(hours % 12 || 12).padStart(2, '0');
    const timestamp = `${year}${month}${day}-${hours12}${minutes}${ampm}`;

    // Create field-data subfolder in the job folder
    const fieldDataMainFolder = 'Field_Data';
    const timestampFolder = timestamp;
    const targetPath = path.join(jobPath, fieldDataMainFolder, timestampFolder);

    // Security: Validate path doesn't escape office root
    const fullPath = validatePath(CONFIG.OFFICE_ROOT, targetPath);
    if (!fullPath) {
      await logger.uploadFailed('Invalid path: traversal attempt blocked', jobPath, uploadId);
      return res.status(400).json({ error: 'Invalid path' });
    }

    // Log start and update progress
    await logger.uploadStarted(jobPath, req.files.length, uploadId);
    progressStore.updateProgress(uploadId, {
      jobPath,
      fileCount: req.files.length,
      status: 'started',
      startTime: uploadStart
    });

    await fs.mkdir(fullPath, { recursive: true });

    // Write uploaded files (method depends on streaming mode)
    let savedCount = 0;
    let totalBytes = 0;

    for (const file of req.files) {
      const destPath = path.join(fullPath, file.originalname);

      if (config.UPLOAD_STREAMING_ENABLED) {
        // File already on disk - move it
        await fs.rename(file.path, destPath);
      } else {
        // Legacy: write from buffer
        await fs.writeFile(destPath, file.buffer);
      }

      savedCount++;
      totalBytes += file.size;
      await logger.uploadFileCompleted(file.originalname, file.size, uploadId);
    }

    const durationMs = Date.now() - uploadStart;
    await logger.uploadCompleted(jobPath, savedCount, totalBytes, durationMs, uploadId);
    progressStore.markCompleted(uploadId, { fileCount: savedCount, totalBytes, durationMs });

    res.json({
      success: true,
      uploadId,
      fieldDataPath: targetPath,
      filesUploaded: savedCount,
      totalBytes,
      durationMs
    });
  } catch (error) {
    console.error('Field data upload error:', error);
    await logger.uploadFailed(error.message, req.body.jobPath || '', uploadId);
    progressStore.markFailed(uploadId, error.message);
    res.status(500).json({ error: error.message });
  } finally {
    // Always cleanup temp directory if streaming
    if (config.UPLOAD_STREAMING_ENABLED) {
      await cleanupTempDir(uploadId);
    }
  }
});

// Sync to controller
app.post('/api/sync-to-controller', async (req, res) => {
  try {
    const { files } = req.body;
    const syncedFiles = [];
    
    for (const filePath of files) {
      const sourcePath = path.join(CONFIG.OFFICE_ROOT, filePath);
      const destPath = path.join(CONFIG.CONTROLLER_ROOT, filePath);
      
      // Create destination directory
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      
      // Copy file
      await fs.copyFile(sourcePath, destPath);
      syncedFiles.push(filePath);
    }
    
    res.json({ success: true, syncedFiles });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync from controller (including photos) - enhanced for field data
app.post('/api/sync-from-controller', async (req, res) => {
  try {
    const { jobPath } = req.body;
    const controllerPath = path.join(CONFIG.CONTROLLER_ROOT, jobPath);
    const officePath = path.join(CONFIG.OFFICE_ROOT, jobPath);
    
    // Create field-data subfolder
    const jobFolderName = path.basename(jobPath);
    const fieldDataFolder = `${jobFolderName}-field-data`;
    const fieldDataPath = path.join(officePath, fieldDataFolder);
    
    console.log('Syncing field data to:', fieldDataPath);
    await fs.mkdir(fieldDataPath, { recursive: true });
    
    // Copy all files from controller to field-data subfolder
    const files = await fs.readdir(controllerPath);
    const results = {
      files: [],
      photos: [],
      csvFiles: [],
      dxfFiles: []
    };
    
    for (const file of files) {
      const sourcePath = path.join(controllerPath, file);
      const destPath = path.join(fieldDataPath, file);
      
      const stats = await fs.stat(sourcePath);
      if (stats.isFile()) {
        await fs.copyFile(sourcePath, destPath);
        
        // Categorize files
        if (file.match(/\.(jpg|jpeg|png)$/i)) {
          results.photos.push(file);
        } else if (file.match(/\.csv$/i)) {
          results.csvFiles.push(file);
        } else if (file.match(/\.dxf$/i)) {
          results.dxfFiles.push(file);
        } else {
          results.files.push(file);
        }
      }
    }
    
    // Update job metadata with sync info
    try {
      const metadataPath = path.join(officePath, 'job_info.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      metadata.lastFieldSync = new Date().toISOString();
      metadata.fieldDataFolder = fieldDataFolder;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (e) {
      // Silently ignore metadata update errors
    }
    
    res.json({ 
      success: true, 
      fieldDataPath: fieldDataFolder,
      results 
    });
  } catch (error) {
    console.error('Sync from controller error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to build folder tree
async function buildFolderTree(rootPath) {
  const tree = {};

  try {
    await fs.access(rootPath);
  } catch {
    // Root path doesn't exist, create it silently
    await fs.mkdir(rootPath, { recursive: true });
    return tree;
  }
  
  const items = await fs.readdir(rootPath, { withFileTypes: true });

  // Sort items: folders first, then by name (descending for numbered folders)
  items.sort((a, b) => {
    // Directories first
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;

    // For numbered folders (e.g., 25-123, 25-100-150), sort descending by number
    const aMatch = a.name.match(/^(\d+)-(\d+)(-\d+)?/);
    const bMatch = b.name.match(/^(\d+)-(\d+)(-\d+)?/);

    if (aMatch && bMatch) {
      // Compare first number
      const aFirst = parseInt(aMatch[1]);
      const bFirst = parseInt(bMatch[1]);
      if (aFirst !== bFirst) return bFirst - aFirst; // Descending

      // Compare second number
      const aSecond = parseInt(aMatch[2]);
      const bSecond = parseInt(bMatch[2]);
      if (aSecond !== bSecond) return bSecond - aSecond; // Descending

      // Compare third number if exists
      if (aMatch[3] && bMatch[3]) {
        const aThird = parseInt(aMatch[3].substring(1));
        const bThird = parseInt(bMatch[3].substring(1));
        return bThird - aThird; // Descending
      }
    }

    // Default: alphabetical ascending for non-numbered items
    return a.name.localeCompare(b.name);
  });

  for (const item of items) {
    if (item.isDirectory()) {
      const itemPath = path.join(rootPath, item.name);
      
      // Check for job metadata
      let metadata = null;
      let folderType = 'folder';
      let address = null;
      
      try {
        const metadataPath = path.join(itemPath, 'job_info.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
        address = metadata.address;
      } catch {}
      
      // Determine folder type based on pattern
      if (item.name.match(/^\d{2}-\d{3}-\d{3}$/)) {
        // Main folder like 25-100-150
        folderType = 'mainFolder';
      } else if (item.name.match(/^\d{2}-\d{3}$/)) {
        // Job number folder like 25-123
        folderType = 'jobNumber';
      } else if (item.name.match(/^\d{2}-\d{3}-\d{6}$/)) {
        // Job folder like 25-123-250708
        folderType = 'job';
      } else if (item.name.endsWith('-field-data') || item.name === 'Field_Data') {
        // Field data folder
        folderType = 'fieldData';
      }
      
      tree[item.name] = {
        type: folderType,
        ...(address && { address }),
        ...(metadata && { metadata }),
        children: await buildFolderTree(itemPath)
      };
      
      // Count photos in job folders
      if (folderType === 'job' || folderType === 'fieldData') {
        const photos = Object.keys(tree[item.name].children).filter(
          f => f.match(/\.(jpg|jpeg|png)$/i)
        ).length;
        if (photos > 0) tree[item.name].photos = photos;
      }
    } else {
      const stats = await fs.stat(path.join(rootPath, item.name));
      tree[item.name] = {
        type: 'file',
        size: formatFileSize(stats.size),
        core: item.name.endsWith('.jxl') || item.name.includes('Control'),
        photo: item.name.match(/\.(jpg|jpeg|png)$/i) ? true : false,
        csv: item.name.match(/\.csv$/i) ? true : false,
        dxf: item.name.match(/\.dxf$/i) ? true : false
      };
    }
  }
  
  return tree;
}

// Helper functions
function formatFileSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Generate JXL and JOB files
app.post('/api/generate-job-file', async (req, res) => {
  console.log('Generating JXL/JOB file:', req.body);
  try {
    const { jobPath, jobName, template, referenceNumber, description, operator, address, linkedFiles } = req.body;
    
    // Get the full job folder name (includes date) from the jobPath
    const pathParts = jobPath.split('/');
    const fullJobName = pathParts[pathParts.length - 1]; // Get the last part which is the full job folder name
    
    // Paths - use fullJobName for file naming
    const jobFullPath = path.join(CONFIG.OFFICE_ROOT, jobPath);
    const jxlPath = path.join(jobFullPath, `${fullJobName}.jxl`);
    const jobFilePath = path.join(jobFullPath, `${fullJobName}.job`);
    
    // Get reference JXL from template
    let referenceJxlPath = '';
    if (template) {
      const templatePath = path.join(CONFIG.TEMPLATES_DIR, template);
      const templateFiles = await fs.readdir(templatePath);
      const jxlFile = templateFiles.find(f => f.endsWith('.jxl'));
      if (jxlFile) {
        referenceJxlPath = path.join(templatePath, jxlFile);
      }
    }
    
    // Separate files by type
    const csvFiles = linkedFiles.filter(f => f.toLowerCase().endsWith('.csv'));
    const dxfFiles = linkedFiles.filter(f => f.toLowerCase().endsWith('.dxf'));
    const landxmlFiles = linkedFiles.filter(f => f.toLowerCase().endsWith('.xml') || f.toLowerCase().endsWith('.landxml'));
    
    // Extract project folder path from jobPath (entire path, not just last folder)
    // jobPath is like "25-150-200/25-150/25-123-250708"
    const projectFolder = jobPath;
    
    // Create Python script command
    const pythonScript = path.join(__dirname, 'trimble-converter', 'jxl_generator.py');
    const pythonArgs = [
      pythonScript,
      '--job-name', jobName,
      '--reference-jxl', referenceJxlPath,
      '--reference', referenceNumber || '',
      '--description', description || '',
      '--operator', operator || '',
      '--job-note', address || '',
      '--project-folder', projectFolder,
      '--output', jxlPath
    ];
    
    // Add file lists
    if (csvFiles.length > 0) {
      pythonArgs.push('--csv-files', ...csvFiles);
    }
    if (dxfFiles.length > 0) {
      pythonArgs.push('--dxf-files', ...dxfFiles);
    }
    if (landxmlFiles.length > 0) {
      pythonArgs.push('--landxml-files', ...landxmlFiles);
    }
    
    // Generate JXL using Python script
    console.log('Running Python script with args:', pythonArgs);
    const python = spawn('python3', pythonArgs);
    
    let output = '';
    let errorOutput = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Python output:', data.toString());
    });
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Python error:', data.toString());
    });
    
    python.on('close', async (code) => {
      console.log('Python script exited with code:', code);
      if (code !== 0) {
        console.error('Python script failed:', errorOutput);
        return res.status(500).json({ error: 'Failed to generate JXL file', details: errorOutput });
      }
      
      // Check if JXL was created
      try {
        await fs.access(jxlPath);
        console.log('JXL file created successfully:', jxlPath);
      } catch (error) {
        console.error('JXL file was not created:', jxlPath);
        return res.status(500).json({ error: 'JXL file was not created' });
      }
      
      // Now convert JXL to JOB using Wine
      const converterPath = path.join(__dirname, 'trimble-converter', 'JobConversion', 'TrimbleAccess.JobConverter.ConverterProcess.exe');
      const converterDir = path.join(__dirname, 'trimble-converter', 'JobConversion');
      const geodataDir = path.join(__dirname, 'trimble-converter', 'geodata');
      
      // Create geodata directory if it doesn't exist
      await fs.mkdir(geodataDir, { recursive: true });
      
      // The converter expects the DLLs (gsconv*.dll) to be in the convertersPath
      // So we pass the JobConversion directory which contains them
      const converterArgs = [
        converterPath,
        '--command=jxl-to-job',
        `--inPath=${jxlPath}`,
        `--outPath=${jobFilePath}`,
        `--convertersPath=${converterDir}`,
        `--geodataPath=${geodataDir}`
      ];
      
      console.log('Running converter with Wine:', converterArgs);
      const converter = spawn('wine', converterArgs, {
        cwd: converterDir
      });
      
      let converterOutput = '';
      let converterError = '';
      
      converter.stdout.on('data', (data) => {
        converterOutput += data.toString();
        console.log('Converter output:', data.toString());
      });
      
      converter.stderr.on('data', (data) => {
        converterError += data.toString();
        // Wine outputs a lot of debug info to stderr, so only log if not Wine noise
        if (!data.toString().includes('wine') && !data.toString().includes('Wine')) {
          console.error('Converter error:', data.toString());
        }
      });
      
      converter.on('error', (error) => {
        console.error('Failed to start converter:', error);
      });
      
      converter.on('close', async (converterCode) => {
        console.log('Converter exited with code:', converterCode);
        
        // Check if JOB file was created (even if Wine returned non-zero)
        try {
          await fs.access(jobFilePath);
          res.json({ 
            success: true, 
            jxlPath: jxlPath,
            jobPath: jobFilePath,
            message: 'JXL and JOB files generated successfully'
          });
        } catch (error) {
          // If no JOB file, at least we have JXL
          res.json({ 
            success: true, 
            jxlPath: jxlPath,
            message: 'JXL generated. JOB conversion failed - use Trimble Access to import JXL.',
            warning: converterError || converterOutput
          });
        }
      });
    });
    
  } catch (error) {
    console.error('Error generating job file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test JXL generation endpoint
app.get('/api/test-jxl', async (req, res) => {
  const pythonScript = path.join(__dirname, 'trimble-converter', 'jxl_generator.py');
  const testJxl = path.join(__dirname, 'trimble-converter', 'test-from-api.jxl');
  const referenceJxl = path.join(CONFIG.TEMPLATES_DIR, 'Zone 1', 'TMNT Z1.jxl');
  
  const pythonArgs = [
    pythonScript,
    '--job-name', 'TEST-API',
    '--reference-jxl', referenceJxl,
    '--reference', 'TEST-REF',
    '--description', 'Test from API',
    '--operator', 'API Test',
    '--job-note', 'Testing API',
    '--output', testJxl
  ];
  
  console.log('Test: Running Python with args:', pythonArgs);
  
  const { spawn } = require('child_process');
  const python = spawn('python', pythonArgs);
  
  let output = '';
  let error = '';
  
  python.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  python.stderr.on('data', (data) => {
    error += data.toString();
  });
  
  python.on('close', (code) => {
    res.json({
      success: code === 0,
      code,
      output,
      error,
      pythonPath: process.env.PATH,
      scriptExists: require('fs').existsSync(pythonScript),
      referenceExists: require('fs').existsSync(referenceJxl)
    });
  });
});

// Android download endpoint - Get list of files in a job
app.get('/api/download-job/*', async (req, res) => {
  try {
    // Get the job path from URL (everything after /api/download-job/)
    const jobPath = req.params[0];
    const fullPath = path.join(CONFIG.OFFICE_ROOT, jobPath);
    
    console.log('Android download request for:', fullPath);
    
    // Check if directory exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: 'Job folder not found' });
    }
    
    // Get all files in the directory recursively
    const files = [];
    
    async function walkDir(dir, relativePath = '') {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        const relativeItemPath = path.join(relativePath, item.name);
        
        if (item.isFile()) {
          const stats = await fs.stat(itemPath);
          files.push({
            name: item.name,
            path: relativeItemPath,
            size: stats.size,
            modified: stats.mtime
          });
        } else if (item.isDirectory()) {
          await walkDir(itemPath, relativeItemPath);
        }
      }
    }
    
    await walkDir(fullPath);
    
    res.json({
      success: true,
      jobPath: jobPath,
      baseUrl: `http://${req.get('host')}/api/download-file/`,
      files: files
    });
    
  } catch (error) {
    console.error('Error listing job files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Android download single file endpoint
app.get('/api/download-file/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = path.join(CONFIG.OFFICE_ROOT, filePath);
    
    // Security check - ensure path doesn't escape office root
    const resolvedPath = path.resolve(fullPath);
    const resolvedRoot = path.resolve(CONFIG.OFFICE_ROOT);
    
    if (!resolvedPath.startsWith(resolvedRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Send file
    res.sendFile(resolvedPath);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Android upload with timestamp - Enhanced field data upload
app.post('/api/upload-field-data-android', fieldDataUpload.array('files'), async (req, res) => {
  const uploadId = req.uploadId || crypto.randomUUID();
  const uploadStart = Date.now();

  try {
    let { jobPath } = req.body;
    if (!jobPath) {
      await logger.uploadFailed('No job path provided', '', uploadId);
      return res.status(400).json({ error: 'Job path required' });
    }

    // FIX: Remove .job filename if present in the path
    if (jobPath.endsWith('.job') || jobPath.endsWith('.JOB')) {
      const lastSlash = jobPath.lastIndexOf('/');
      if (lastSlash > 0) {
        jobPath = jobPath.substring(0, lastSlash);
      }
    }

    // Create timestamp for folder name in format YYMMDD-HHMMAM
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = String(hours % 12 || 12).padStart(2, '0');
    const timestamp = `${year}${month}${day}-${hours12}${minutes}${ampm}`;

    // Create folder structure like: Field_Data/260107-0925AM
    const fieldDataMainFolder = 'Field_Data';
    const timestampFolder = timestamp;
    const targetPath = path.join(jobPath, fieldDataMainFolder, timestampFolder);

    // Security: Validate path doesn't escape office root
    const fullPath = validatePath(CONFIG.OFFICE_ROOT, targetPath);
    if (!fullPath) {
      await logger.uploadFailed('Invalid path: traversal attempt blocked', jobPath, uploadId);
      return res.status(400).json({ error: 'Invalid path' });
    }

    // Check for duplicate upload (idempotency)
    const duplicate = await idempotencyStore.checkDuplicate(jobPath, req.files);
    if (duplicate) {
      await logger.log(`Duplicate upload detected for ${jobPath} - returning cached result [ID: ${uploadId}]`);
      return res.json(duplicate);
    }

    // Log upload started
    await logger.uploadStarted(jobPath, req.files.length, uploadId);

    // Update progress store
    progressStore.updateProgress(uploadId, {
      jobPath,
      fileCount: req.files.length,
      status: 'started',
      bytesReceived: 0,
      startTime: uploadStart
    });

    await fs.mkdir(fullPath, { recursive: true });

    // Write uploaded files (streaming or buffer depending on mode)
    let savedCount = 0;
    const savedFiles = [];
    let totalBytes = 0;

    for (const file of req.files) {
      const destPath = path.join(fullPath, file.originalname);

      if (config.UPLOAD_STREAMING_ENABLED) {
        // File already on disk in temp location - move it atomically
        await fs.rename(file.path, destPath);
      } else {
        // Legacy: write from memory buffer
        await fs.writeFile(destPath, file.buffer);
      }

      // Compute checksum if enabled
      let checksum = null;
      if (config.UPLOAD_CHECKSUM_ENABLED) {
        checksum = await computeChecksum(destPath);
      }

      savedFiles.push({
        name: file.originalname,
        size: file.size,
        ...(checksum && { checksum })
      });

      savedCount++;
      totalBytes += file.size;

      // Log per-file completion
      await logger.uploadFileCompleted(file.originalname, file.size, uploadId);
    }

    // Update job metadata with upload info
    try {
      const jobDir = path.join(CONFIG.OFFICE_ROOT, jobPath);
      const metadataPath = path.join(jobDir, 'job_info.json');
      let metadata;
      try {
        metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      } catch (e) {
        // If metadata doesn't exist, create it
        metadata = {
          created: now.toISOString()
        };
      }

      if (!metadata.fieldDataUploads) {
        metadata.fieldDataUploads = [];
      }

      metadata.fieldDataUploads.push({
        uploadId,
        timestamp: now.toISOString(),
        folder: `${fieldDataMainFolder}/${timestampFolder}`,
        fileCount: savedCount,
        totalBytes,
        durationMs: Date.now() - uploadStart
      });

      // If field status includes jobType update flag, save jobType to job_info.json
      const pendingStatusForJobType = pendingFieldStatus.get(jobPath);
      if (pendingStatusForJobType) {
        try {
          const fieldStatusData = pendingStatusForJobType.data;
          if (fieldStatusData.updateJobType && fieldStatusData.jobType) {
            metadata.jobType = fieldStatusData.jobType;
            console.log(`Updated job_info.json with jobType: ${fieldStatusData.jobType}`);
          }
        } catch (e) {
          console.error('Error checking field status for jobType update:', e);
        }
      }

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (e) {
      // Silently ignore metadata update errors
    }

    // Create field_status.json if field status data provided (from pending store)
    const pendingStatus = pendingFieldStatus.get(jobPath);
    let fieldStatusForNotification = null; // Capture for notification before deletion

    if (pendingStatus) {
      try {
        const fieldStatusData = pendingStatus.data;
        console.log(`✅ Using pending field status for job: ${jobPath}`);

        // Extract job number from jobPath (e.g., "25-000-050/26-001/26-001-260106" -> "26-001")
        const pathParts = jobPath.split('/');
        const jobNumber = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : '';
        const controllerJob = pathParts.length >= 1 ? pathParts[pathParts.length - 1] : '';

        // Extract CSV data for all upload types
        const csvData = await extractCSVData(fullPath);

        // Determine upload type (default to 'complete' for backward compatibility)
        const uploadType = fieldStatusData.uploadType || 'complete';

        // Build field_status.json with upload_type
        const fieldStatus = {
          _schema_version: "1.0",
          job_number: jobNumber,
          controller_job: controllerJob,
          upload_folder: timestampFolder,
          upload_timestamp: now.toISOString(),

          operator: fieldStatusData.operator,
          job_type: fieldStatusData.jobType || metadata?.jobType || 'survey_rpr',

          upload_type: uploadType, // 'intermediate', 'complete', or 'reupload'
          replaces_folder: uploadType === 'reupload' ? (fieldStatusData.replacesFolder || null) : null,

          // Time tracking - only for complete uploads
          time_spent: uploadType === 'complete' ? {
            field_hours: parseFloat(fieldStatusData.timeOnSite) || null,
            travel_hours_oneway: parseFloat(fieldStatusData.travelTime) || null
          } : null,

          field_work_done: uploadType === 'complete' ? (fieldStatusData.fieldWorkDone === 'yes') : null,
          estimated_time_remaining: uploadType === 'complete' ? (parseFloat(fieldStatusData.estimatedTimeRemaining) || null) : null,

          // Pins and tasks - only for complete uploads
          pins_found: uploadType === 'complete' ? (fieldStatusData.pinsFound || null) : null,
          pins_placed: uploadType === 'complete' ? (fieldStatusData.pinsPlaced || null) : null,

          construction_tasks_completed: uploadType === 'complete' ? (fieldStatusData.constructionTasks || []) : [],
          custom_tasks_completed: uploadType === 'complete' && fieldStatusData.customTasks ? [fieldStatusData.customTasks] : [],

          // Notes - available for all upload types
          notes: uploadType === 'reupload'
            ? `Re-upload${fieldStatusData.replacesFolder ? ` - replaces ${fieldStatusData.replacesFolder}` : ''}`
            : (fieldStatusData.notes || (fieldStatusData.notesWhatLeft ? `What's left: ${fieldStatusData.notesWhatLeft}` : null)),

          qbo_sync: {
            time_synced: false,
            time_entry_id: null,
            synced_at: null
          }
        };

        // Add CSV extracted data if available
        if (csvData) {
          fieldStatus.csv_extracted = csvData;
        }

        // Capture for notification BEFORE deletion
        fieldStatusForNotification = fieldStatus;

        // Write field_status.json to upload folder
        const fieldStatusPath = path.join(fullPath, 'field_status.json');
        await fs.writeFile(fieldStatusPath, JSON.stringify(fieldStatus, null, 2));
        console.log(`✅ Created field_status.json: ${fieldStatusPath}`);

        // Remove from pending store after successful creation
        pendingFieldStatus.delete(jobPath);
        console.log(`✅ Cleared pending field status for: ${jobPath}`);
      } catch (e) {
        console.error(`❌ Error creating field_status.json for ${jobPath}:`, e);
        // Don't fail the upload if field status creation fails
        // Still clean up the pending status
        pendingFieldStatus.delete(jobPath);
      }
    } else {
      // Log why field_status.json wasn't created
      console.warn(`⚠️  No pending field status found for: ${jobPath}`);
      console.warn(`⚠️  Upload will succeed but field_status.json will NOT be created`);
      console.warn(`⚠️  Pending status may have expired, or POST never reached server`);
      console.warn(`⚠️  Current pending status keys:`, Array.from(pendingFieldStatus.keys()));
    }

    // Calculate duration and speed
    const durationMs = Date.now() - uploadStart;

    // Log completion
    await logger.uploadCompleted(jobPath, savedCount, totalBytes, durationMs, uploadId);

    // Mark as completed in progress store
    progressStore.markCompleted(uploadId, {
      fileCount: savedCount,
      totalBytes,
      durationMs
    });

    const result = {
      success: true,
      uploadId,
      fieldDataPath: targetPath,
      folder: `${fieldDataMainFolder}/${timestampFolder}`,
      filesUploaded: savedCount,
      files: savedFiles,
      totalBytes,
      durationMs
    };

    // Store for idempotency
    await idempotencyStore.storeResult(jobPath, req.files, result);

    // Notify Hive Mind of field data upload
    const pathParts = jobPath.split('/');
    const jobNumber = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : null;

    await queueNotification('field_data_uploaded', {
      job_number: jobNumber,
      job_path: jobPath,
      folder_name: timestampFolder,
      field_status_exists: fieldStatusForNotification !== null,
      field_status: fieldStatusForNotification ? {
        operator: fieldStatusForNotification.operator,
        job_type: fieldStatusForNotification.job_type,
        upload_type: fieldStatusForNotification.upload_type,
        field_work_done: fieldStatusForNotification.field_work_done,
        time_spent: fieldStatusForNotification.time_spent,
        pins_found: fieldStatusForNotification.pins_found,
        pins_placed: fieldStatusForNotification.pins_placed,
        notes: fieldStatusForNotification.notes,
        csv_extracted: fieldStatusForNotification.csv_extracted
      } : null,
      file_count: savedCount,
      total_bytes: totalBytes,
      upload_timestamp: now.toISOString()
    });

    res.json(result);

  } catch (error) {
    console.error('Android field data upload error:', error);

    // Log upload failure from controller
    await logger.uploadFailed(error.message, req.body.jobPath || '', uploadId);

    // Mark as failed in progress store
    progressStore.markFailed(uploadId, error.message);

    res.status(500).json({ error: error.message });
  } finally {
    // Always cleanup temp directory if streaming
    if (config.UPLOAD_STREAMING_ENABLED) {
      await cleanupTempDir(uploadId);
    }
  }
});

// Download folder as ZIP (for field data)
app.get('/api/download-zip/*', async (req, res) => {
  try {
    const folderPath = req.params[0];
    const fullPath = path.join(CONFIG.OFFICE_ROOT, folderPath);
    
    console.log('Creating ZIP for:', fullPath);
    
    // Check if folder exists
    try {
      await fs.access(fullPath);
    } catch {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Set response headers
    const folderName = path.basename(folderPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);
    
    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Handle errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).send({ error: err.message });
    });
    
    // Pipe archive to response
    archive.pipe(res);
    
    // Add folder to archive
    archive.directory(fullPath, false);
    
    // Finalize
    await archive.finalize();
    
  } catch (error) {
    console.error('Error creating ZIP:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Client-side logging endpoint - allows frontend to send logs to server
app.post('/api/log', express.json(), async (req, res) => {
  try {
    const { action, detail } = req.body;

    // Route to appropriate logger method
    switch (action) {
      case 'controller-opened':
        await logger.controllerOpened();
        break;
      case 'upload-clicked':
        await logger.uploadClicked(detail || '');
        break;
      case 'download-clicked':
        await logger.downloadClicked(detail || '');
        break;
      default:
        await logger.log(`${action}: ${detail || ''}`);
    }

    res.json({ success: true });
  } catch (error) {
    // Fail silently - logging errors should not impact app
    console.error('Log endpoint error (non-critical):', error);
    res.json({ success: false });
  }
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Diagnostic endpoint for external proxy/header verification
app.get('/api/whoami', (req, res) => {
  res.json({
    host: req.get('host'),
    xForwardedHost: req.get('x-forwarded-host') || null,
    xForwardedProto: req.get('x-forwarded-proto') || null,
    xRealIp: req.get('x-real-ip') || null,
    xForwardedFor: req.get('x-forwarded-for') || null,
    userAgent: req.get('user-agent') || null,
    method: req.method,
    path: req.path,
    time: new Date().toISOString(),
    redirectsEnabled: config.HOST_REDIRECTS_ENABLED,
    targetHost: config.HOST_REDIRECTS_ENABLED
      ? config.HOST_REDIRECTS_TARGET_HOST
      : 'disabled'
  });
});

// ============================================================
// UPLOAD PROGRESS API (Feature-Flagged)
// ============================================================

// Get status for specific upload
app.get('/api/upload-status/:uploadId', (req, res) => {
  if (!config.UPLOAD_PROGRESS_API) {
    return res.status(404).json({ error: 'Progress API disabled' });
  }

  const { uploadId } = req.params;
  const progress = progressStore.getProgress(uploadId);

  if (!progress) {
    return res.json({
      status: 'not_found',
      message: 'Upload not found or completed more than 1 hour ago'
    });
  }

  res.json({
    status: 'ok',
    uploadId,
    ...progress
  });
});

// List all active uploads
app.get('/api/upload-status', (req, res) => {
  if (!config.UPLOAD_PROGRESS_API) {
    return res.status(404).json({ error: 'Progress API disabled' });
  }

  const active = progressStore.listActive();
  res.json({ active });
});

// ============================================================
// SERVER STARTUP
// ============================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('============================================================');
  console.log('   TRIMBLE DATA SYNC SERVER - STARTUP');
  console.log('============================================================');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`  Local access:   http://localhost:${PORT}`);
  console.log(`  Network access: http://[YOUR-IP]:${PORT}`);
  console.log(`  Status monitor: http://[YOUR-IP]:${PORT}/upload-status.html`);
  console.log('');
  console.log('Data paths:');
  console.log(`  Office jobs:      ${CONFIG.OFFICE_ROOT}`);
  console.log(`  Controller jobs:  ${CONFIG.CONTROLLER_ROOT}`);
  console.log(`  Templates:        ${CONFIG.TEMPLATES_DIR}`);
  console.log('');
  const fileSizeMB = parseInt(process.env.UPLOAD_MAX_FILE_MB || '100', 10);
  const fileSizeBytes = fileSizeMB * 1024 * 1024;
  console.log('Upload configuration:');
  console.log(`  Max file size:    ${fileSizeMB} MB (${fileSizeBytes.toLocaleString()} bytes)`);
  console.log(`  Temp directory:   ${config.UPLOAD_TEMP_DIR}`);
  console.log(`  Idempotency DB:   ${process.env.IDEMPOTENCY_STORE_PATH || path.join(__dirname, 'upload-idempotency.json')}`);
  console.log('');
  console.log('Resilience features (feature-flagged):');
  console.log(`  Streaming mode:   ${config.UPLOAD_STREAMING_ENABLED ? 'ENABLED' : 'disabled'}`);
  console.log(`  Progress API:     ${config.UPLOAD_PROGRESS_API ? 'ENABLED' : 'disabled'}`);
  console.log(`  Checksums:        ${config.UPLOAD_CHECKSUM_ENABLED ? 'ENABLED' : 'disabled'}`);
  console.log(`  Idempotency:      ${config.UPLOAD_IDEMPOTENCY_ENABLED ? 'ENABLED' : 'disabled'}`);
  console.log(`  Server timeout:   ${config.SERVER_TIMEOUT_MS}ms`);
  console.log(`  Keep-alive:       ${config.SERVER_KEEPALIVE_MS}ms`);
  console.log('');
  console.log(`Timezone: ${process.env.TZ || 'system default'}`);
  console.log('============================================================');
});

// Configure server timeouts for slow uploads
server.timeout = config.SERVER_TIMEOUT_MS;
server.keepAliveTimeout = config.SERVER_KEEPALIVE_MS;
server.headersTimeout = config.SERVER_KEEPALIVE_MS + 1000; // Must be > keepAliveTimeout

console.log(`Server timeouts configured: request=${config.SERVER_TIMEOUT_MS}ms, keepAlive=${config.SERVER_KEEPALIVE_MS}ms`);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

/**
 * Graceful shutdown handler
 * Stops accepting new requests and gives inflight uploads 15s to finish
 */
function shutdown(signal) {
  console.log(`${signal} received, initiating graceful shutdown...`);
  server.close(() => {
    console.log('Server closed. All connections terminated.');
    process.exit(0);
  });

  // Force exit after 15 seconds if connections don't close
  setTimeout(() => {
    console.warn('Forced shutdown after 15s timeout');
    process.exit(0);
  }, 15000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));