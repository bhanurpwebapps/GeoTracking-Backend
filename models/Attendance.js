const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  attendanceStatus: { type: String, enum: ['Arrived', 'Present', 'Absent', 'Late'], required: true },
  areaType: { type: String, enum: ['UnAuthorized', 'Sensitive Area', 'Authorized'], required: true },
  lastDetectionTime: { type: Date, required: true },
  deviceId: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
