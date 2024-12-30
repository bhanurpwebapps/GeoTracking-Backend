const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client', 
    required: true
  },
  attendanceStatus: { type: String, enum: ['Arrived', 'Present', 'Absent', 'Late','Exited','Entered'], required: true },
  areaName : {type: String, required: false},
  areaType: { type: String, enum: ['UnAuthorized', 'Sensitive Area', 'Authorized'], required: false },
  areaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Area', required: false },
  lastDetectionTime: { type: Date, required: true },
  deviceId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
