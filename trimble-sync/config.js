/**
 * Feature flags for upload resilience improvements
 * All default to FALSE to prevent regression
 *
 * Enable via environment variables in docker-compose.yml:
 *   - UPLOAD_STREAMING_ENABLED=true
 *   - UPLOAD_PROGRESS_API=true
 *   - etc.
 */

module.exports = {
  // B: App-layer streaming
  UPLOAD_STREAMING_ENABLED: process.env.UPLOAD_STREAMING_ENABLED === 'true',
  UPLOAD_STREAM_HIGHWATER: parseInt(process.env.UPLOAD_STREAM_HIGHWATER) || 65536, // 64KB chunks

  // C: Integrity & idempotency
  UPLOAD_CHECKSUM_ENABLED: process.env.UPLOAD_CHECKSUM_ENABLED === 'true',
  UPLOAD_IDEMPOTENCY_ENABLED: process.env.UPLOAD_IDEMPOTENCY_ENABLED === 'true',

  // D: Pseudo-resumption (NOT RECOMMENDED without client changes)
  UPLOAD_RESUME_ENABLED: process.env.UPLOAD_RESUME_ENABLED === 'true',
  UPLOAD_PARTIAL_RETENTION_HOURS: parseInt(process.env.UPLOAD_PARTIAL_RETENTION_HOURS) || 24,

  // E: Timeouts and back-pressure
  SERVER_TIMEOUT_MS: parseInt(process.env.SERVER_TIMEOUT_MS) || 120000, // 2 min default (unchanged)
  SERVER_KEEPALIVE_MS: parseInt(process.env.SERVER_KEEPALIVE_MS) || 65000,

  // F: Observability
  UPLOAD_PROGRESS_API: process.env.UPLOAD_PROGRESS_API === 'true',
  UPLOAD_PROGRESS_INTERVAL_BYTES: parseInt(process.env.UPLOAD_PROGRESS_INTERVAL_BYTES) || 1048576, // 1MB

  // Paths
  UPLOAD_TEMP_DIR: process.env.UPLOAD_TEMP_DIR || '/tmp/uploads',
  UPLOAD_PARTIAL_DIR: process.env.UPLOAD_PARTIAL_DIR || '/tmp/uploads-partial',

  // Legacy host redirect (for old QuickConnect URLs)
  // NOTE: Only works when DNS for the legacy host resolves to this server
  HOST_REDIRECTS_ENABLED: process.env.HOST_REDIRECTS_ENABLED === 'true',
  HOST_REDIRECTS_LEGACY_HOSTS: (process.env.HOST_REDIRECTS_LEGACY_HOSTS ||
    'pardysurveys.direct.quickconnect.to,pardysurveys.direct.quickconnect.to:3000')
    .split(',')
    .map(h => h.trim().toLowerCase()),
  HOST_REDIRECTS_TARGET_HOST: process.env.HOST_REDIRECTS_TARGET_HOST ||
    'pardysurveys.synology.me',
  HOST_REDIRECTS_TARGET_PROTO: process.env.HOST_REDIRECTS_TARGET_PROTO ||
    'https',

  // CORS allowed origins (optional; if not set, uses existing CORS logic)
  CORS_ALLOW_ORIGINS: process.env.CORS_ALLOW_ORIGINS
    ? process.env.CORS_ALLOW_ORIGINS.split(',').map(o => o.trim())
    : null,

  // Notification system (for Hive Mind integration)
  NOTIFICATIONS_ENABLED: process.env.NOTIFICATIONS_ENABLED === 'true'
};
