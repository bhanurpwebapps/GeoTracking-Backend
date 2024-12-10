const aedes = require('aedes')();
const { createServer } = require('net');
const moment = require('moment');
const mongoose = require('mongoose');
const Student = require('./models/Student');
const Area = require('./models/Area');
const School = require('./models/School');

// MQTT Server Setup
const mqttPort = 1883;
const server = createServer(aedes.handle);
server.listen(mqttPort, () => {
  console.log(`Aedes MQTT server running on port ${mqttPort}`);
});

let studentStatuses = {}; // Cache for student tag statuses

// Aedes Event Listener: Client Publish
aedes.on('publish', async (packet, client) => {
  try {
    const { topic, payload } = packet;

    if (topic === 'school/ble') {
      const tagId = payload.toString().trim(); // Extract BLE badge ID
      await handleMQTTPublish(tagId);
    }
  } catch (error) {
    console.error('Error handling publish:', error.message);
  }
});

// MQTT Message Processing
async function handleMQTTPublish(tagId) {
  try {
    const timestamp = Date.now();
    const student = await Student.findOne({ bleBadgeId: tagId });
    if (!student) return; // Ignore if no student found

    const school = await School.findById(student.schoolId);
    if (!school) return;

    const currentArea = await Area.findById(student.area);
    if (!currentArea) return;

    // Load timeout settings dynamically
    const now = moment();
    const schoolStartTime = moment(school.startTime, "HH:mm");
    const schoolEndTime = moment(school.endTime, "HH:mm");

    const classroomPresenceTimeout = school.classroomPresenceTimeout || 30000; // Default: 30 seconds
    const absenceTimeout = school.absenceTimeout || 1800000; // Default: 30 minutes
    const lateDetectionTimeout = school.lateDetectionTimeout || 2100000; // Default: 35 minutes
    const unauthorizedZoneTimeout = school.unauthorizedZoneTimeout || 300000; // Default: 5 minutes
    const sensitiveAreaTimeout = school.sensitiveAreaTimeout || 300000; // Default: 5 minutes

    // Skip processing outside school hours
    if (now.isBefore(schoolStartTime) || now.isAfter(schoolEndTime)) {
      return;
    }

    // Initialize or update student status
    const lastSeen = studentStatuses[tagId]?.lastSeen || 0;

    // Handle reception area instant presence
    if (currentArea.name === 'Reception' && !studentStatuses[tagId]?.arrived) {
      await markPresent(student);
      studentStatuses[tagId] = { lastSeen: timestamp, arrived: true };
      return;
    }

    // Handle classroom presence
    if (
      currentArea.name === 'Classroom' &&
      timestamp - lastSeen > classroomPresenceTimeout
    ) {
      await markPresent(student);
    }

    // Handle absence
    if (timestamp - lastSeen > absenceTimeout) {
      await markAbsent(student);
    }

    // Handle late detection
    if (
      timestamp - lastSeen > absenceTimeout &&
      timestamp - lastSeen <= lateDetectionTimeout
    ) {
      await markLate(student);
    }

    // Handle unauthorized zone detection
    if (
      currentArea.status === 'Unauthorized' &&
      timestamp - lastSeen > unauthorizedZoneTimeout
    ) {
      sendUnauthorizedAlert(student);
    }

    // Handle sensitive area timeout
    if (
      currentArea.type === 'Sensitive' &&
      timestamp - lastSeen > sensitiveAreaTimeout
    ) {
      sendAlertToParents(student);
    }

    // Update student's last seen time
    studentStatuses[tagId] = { lastSeen: timestamp };
  } catch (error) {
    console.error('Error handling tag:', error);
  }
}

// Helper Functions
async function markPresent(student) {
  console.log(`Marking student ${student.studentName} as present`);
  student.status = 'Present';
  await student.save();
}

async function markAbsent(student) {
  console.log(`Marking student ${student.studentName} as absent`);
  student.status = 'Absent';
  await student.save();
}

async function markLate(student) {
  console.log(`Marking student ${student.studentName} as late`);
  student.status = 'Late';
  await student.save();
}

async function sendUnauthorizedAlert(student) {
  console.log(`Unauthorized zone alert for student ${student.studentName}`);
  // Add notification logic
}

async function sendAlertToParents(student) {
  console.log(`Sensitive zone alert for student ${student.studentName}`);
  // Add notification logic
}

// MongoDB Connection
mongoose
  .connect('mongodb://localhost:27017/school_tracking', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((error) => console.error('MongoDB connection error:', error));
