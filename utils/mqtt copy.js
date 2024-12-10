const aedes = require('aedes')();
const moment = require('moment');
const net = require('net');
const Gateway = require('../models/Gateway');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Area = require('../models/Area');
const { sendAlertToParents, sendUnauthorizedAlert } = require('../utils/alerts');
// MQTT Broker Setup
const MQTT_PORT = 1883;
const mqttServer = net.createServer(aedes.handle);
mqttServer.listen(MQTT_PORT, () => console.log(`MQTT broker running on port ${MQTT_PORT}`));
aedes.on('client', client => console.log(`Client connected: ${client.id}`));
aedes.on('clientDisconnect', client => console.log(`Client disconnected: ${client.id}`));
aedes.on('publish', async (packet, client) => handleMQTTPublish(packet));

// Handle MQTT Publish Events
async function handleMQTTPublish(packet) {
  try {

    const gatewayMacId = packet.topic.toString().split('gw/scanpub/')[1];
    if (gatewayMacId) {
      const gateWay = await Gateway.findOne({ macAddress: gatewayMacId.toUpperCase() });
      if (!gateWay) return;
      
      //const gateway.
      //const area = 
      const tagId = packet.payload.toString();  // BLE tag ID
      const timestamp = Date.now();


    }
    //if (client) {
    //console.log(`Message received on topic: ${packet.topic.toString().split('gw/scanpub/')[1]}`);
    //console.log(`Message received on topic: ${packet.payload.toString()}`);
    //return;
    //}
    // const tagId = packet.payload.toString();  // BLE tag ID
    // const timestamp = Date.now();
    // const student = await Student.findOne({ bleBadgeId: tagId });

    // if (!student) return;  // Ignore if no student found for the tag

    // const currentArea = await Area.findOne({ _id: student.area });
    // if (!currentArea) return;

    // const now = moment();
    // const school = await School.findById(student.schoolId);

    // if (now.isBefore(moment(school.startTime)) || now.isAfter(moment(school.endTime))) {
    //   return;  // Ignore if outside school hours
    // }

    // // Handle instant arrival at reception
    // if (currentArea.name === 'Reception' && !studentStatuses[tagId]?.arrived) {
    //   await markPresent(student);  // Instant mark as present
    //   studentStatuses[tagId] = { lastSeen: timestamp, arrived: true };
    //   return;
    // }

    // // Handle classroom attendance
    // if (currentArea.name === 'Classroom' && timestamp - studentStatuses[tagId]?.lastSeen > tagPresenceTime) {
    //   await markPresent(student);
    // }

    // // Handle absence marking if no tag detected for 30 minutes
    // if (timestamp - studentStatuses[tagId]?.lastSeen > maxAbsentTime) {
    //   await markAbsent(student);
    // }

    // // Handle late marking if detected after absence
    // if (timestamp - studentStatuses[tagId]?.lastSeen > maxAbsentTime && currentArea.status !== 'Unauthorized') {
    //   await markLate(student);
    // }

    // // Handle unauthorized zone detection
    // if (currentArea.status === 'Unauthorized' && timestamp - studentStatuses[tagId]?.lastSeen > tagLateTime) {
    //   sendUnauthorizedAlert(student);
    // }

    // // Handle sensitive zone alert after 5 minutes
    // if (currentArea.type === 'Sensitive' && timestamp - studentStatuses[tagId]?.lastSeen > sensitiveZoneAlertTime) {
    //   sendAlertToParents(student);
    // }

    // studentStatuses[tagId] = { lastSeen: timestamp };
  } catch (error) {
    console.error('Error handling MQTT publish:', error);
  }
}


async function markPresent(student) {
  const attendance = new Attendance({
    studentId: student._id,
    status: 'Present',
  });
  await attendance.save();
}

async function markAbsent(student) {
  const attendance = new Attendance({
    studentId: student._id,
    status: 'Absent',
  });
  await attendance.save();
}

async function markLate(student) {
  const attendance = new Attendance({
    studentId: student._id,
    status: 'Late',
  });
  await attendance.save();
}

module.exports = { aedes };
