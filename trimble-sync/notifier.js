/**
 * Notification Queue System
 * Writes events to JSONL file for Hive Mind to consume
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const NOTIFICATION_FILE = '/data/notifications/events.jsonl';

/**
 * Queue a notification event for Hive Mind
 * Non-blocking: failures are logged but don't throw
 *
 * @param {string} eventType - Event type (layout_job_created, field_data_uploaded)
 * @param {object} data - Event-specific data
 */
async function queueNotification(eventType, data) {
  console.log(`[Notification] queueNotification called: ${eventType}, NOTIFICATIONS_ENABLED=${config.NOTIFICATIONS_ENABLED}`);

  // Feature flag check
  if (!config.NOTIFICATIONS_ENABLED) {
    console.log(`[Notification] Skipping - notifications disabled`);
    return;
  }

  const event = {
    id: crypto.randomUUID(),
    event: eventType,
    timestamp: new Date().toISOString(),
    data
  };

  try {
    // Ensure directory exists
    const dir = path.dirname(NOTIFICATION_FILE);
    await fs.mkdir(dir, { recursive: true });

    // Append to JSONL file (one JSON object per line)
    await fs.appendFile(NOTIFICATION_FILE, JSON.stringify(event) + '\n', 'utf8');

    console.log(`[Notification] Queued: ${eventType} - ${data.job_number || 'N/A'}`);
  } catch (error) {
    // Non-blocking: log error but don't throw
    console.error(`[Notification] Failed to queue ${eventType}: ${error.message}`);
  }
}

module.exports = { queueNotification };
