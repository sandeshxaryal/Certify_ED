// src/models/activityLog.model.js
import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'LOGIN',
      'LOGOUT',
      'PASSWORD_CHANGE',
      'CERTIFICATE_GENERATED',
      'CERTIFICATE_BULK_GENERATED',
      'CERTIFICATE_REVOKED',
      'CERTIFICATE_UNREVOKED',
      'EXTERNAL_CERTIFICATE_GENERATED',
      'DOCUMENT_SIGNED',
    ]
  },
  description: {
    type: String,
    required: true
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// TTL index — auto-delete logs older than 1 year
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export default mongoose.model('ActivityLog', ActivityLogSchema);