// src/helpers/recordLog.js
import ActivityLog from '../schemas/log.schema.js';

/**
 * Fire-and-forget activity logger. Never throws — safe to call anywhere.
 *
 * @param {Object} opts
 * @param {string}  opts.userId      - MongoDB user _id
 * @param {string}  opts.type        - ActivityLog type enum value
 * @param {string}  opts.description - Human-readable description
 * @param {Object}  [opts.meta]      - Extra context (certificateId, candidateName, etc.)
 * @param {Object}  [opts.req]       - Express request (for IP + UA)
 */
const logActivity = async ({ userId, type, description, meta = {}, req = null }) => {
  try {
    await ActivityLog.create({
      user: userId,
      type,
      description,
      meta,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || undefined,
      userAgent: req?.headers?.['user-agent'] || undefined
    });
  } catch (err) {
    // Non-critical — log to console but never crash the caller
    console.error('[logActivity] Failed to write activity log:', err.message);
  }
};

export default logActivity;