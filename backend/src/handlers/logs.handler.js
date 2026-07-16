// src/handlers/logs.handler.js
import ActivityLog from '../schemas/log.schema.js';

/**
 * GET /api/activity
 * Returns paginated activity logs for the authenticated user.
 * Query params: page (default 1), limit (default 20)
 */
export const getMyActivity = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      ActivityLog.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments({ user: req.user.id })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      }
    });
  } catch (error) {
    console.error('[getMyActivity] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
  }
};