const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define user schema
const schoolSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  schoolStartAt: { type: String, required: true, default: "08:00 AM" },
  schoolEndAt: { type: String, required: true, default: "03:00 PM" },
  classroomPresenceTimeout: { type: Number, required: true, default: 10 }, // in seconds
  absenceTimeout: { type: Number, required: true, default: 60 }, // in minutes
  lateDetectionTimeout: { type: Number, required: true, default: 15 }, // in minutes
  unauthorizedZoneTimeout: { type: Number, required: true, default: 5 }, // in minutes
  sensitiveAreaTimeout: { type: Number, required: true, default: 2 } // in minutes
}, { timestamps: true });


module.exports = mongoose.model('School', schoolSchema);
