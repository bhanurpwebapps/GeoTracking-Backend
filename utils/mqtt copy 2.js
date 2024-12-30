const aedes = require('aedes')({
  connectTimeout: 20000, // Wait 20 seconds before timing out
  heartbeatInterval: 30000, // Check client liveness every 30 seconds
});
const moment = require('moment');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const net = require('net');
const School = require('../models/School');
const Gateway = require('../models/Gateway');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Area = require('../models/Area');
const io = require('../server');
const { sendAlertToParents, sendUnauthorizedAlert } = require('../utils/alerts');
// MQTT Broker Setup
const MQTT_PORT = 1883;
const mqttServer = net.createServer(aedes.handle);
let gatewayStatus = {}; // To track the current status of each gateway
mqttServer.listen(MQTT_PORT, () => console.log(`MQTT broker running on port ${MQTT_PORT}`));
// Create a transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // Replace with your email provider's SMTP host
  port: 587, // Replace with your SMTP port
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'bhanubommalakunta@gmail.com ', // Replace with your email
    pass: 'Krishna@11', // Replace with your email password
  },
});
aedes.on('client', async (client) => {
  console.log(`Client connected: ${client.id}`);

  // Check if the status has changed
  if (!gatewayStatus[client.id] || gatewayStatus[client.id] !== true) {
    //setInterval(() => {
    // Check if the status has changed
    if (!gatewayStatus[client.id] || gatewayStatus[client.id] !== false) {
      gatewayStatus[client.id] = true; // Update status to disconnected
      global.io.emit('gatewayStatus', { id: client.id, connected: true });
      connectedStatus = true;
      const updatedGateway = await Gateway.findOneAndUpdate(
        { macAddress: client.id.toUpperCase() },
        { connectedStatus: connectedStatus },
        { new: true } // Return the updated document
      );
    }
    //}, 5000);
  }

});
aedes.on('clientDisconnect', async (client) => {
  console.log(`Client disconnected: ${client.id}`);
  //setInterval(() => {
  // Check if the status has changed
  if (!gatewayStatus[client.id] || gatewayStatus[client.id] !== false) {
    gatewayStatus[client.id] = false; // Update status to disconnected
    global.io.emit('gatewayStatus', { id: client.id, connected: false });
    connectedStatus = false;
    // Update the connectedStatus field for the specified gateway
    const updatedGateway = await Gateway.findOneAndUpdate(
      { macAddress: client.id.toUpperCase() },
      { connectedStatus: connectedStatus },
      { new: true } // Return the updated document
    );
  }
  //}, 5000);
});
aedes.on('publish', async (packet, client) => handleMQTTPublish(packet));


// Handle MQTT Publish Events
async function handleMQTTPublish(packet) {
  try {

    const gatewayMacId = packet.topic.toString().split('gw/scanpub/')[1];
    if (gatewayMacId) {

      const gateways = await Gateway.aggregate([
        {
          $match: {
            $and: [
              { macAddress: gatewayMacId.toUpperCase() } // Match the specific clientId
            ]
          }
        },
        {
          $lookup: {
            from: 'areas', // The collection name for the Area model
            localField: 'areaId', // Field in Gateway to match
            foreignField: '_id', // Field in Area to match
            as: 'areaDetails' // The resulting array field to hold matched data
          }
        },
        {
          $unwind: '$areaDetails' // Flatten the areaDetails array
        },
        {
          $project: {
            _id: 1,
            macAddress: '$macAddress', // Assuming the gateway's MAC address
            minRSSI: '$minRSSI',
            maxRSSI: '$maxRSSI',
            status: '$status',
            areaId: '$areaId',
            clientId: '$clientId',
            areaName: '$areaDetails.name' // Pull only the name of the area
          }
        }
      ]);

      if (!gateways) return;

      //console.log(gateways[0]);

      const areaId = gateways[0].areaId.toString();
      const areaName = gateways[0].areaName;
      const clientId = gateways[0].clientId;
      const minRSSI = gateways[0].minRSSI;
      const maxRSSI = gateways[0].maxRSSI;


      const bleTagData = packet.payload.toString();  // BLE tag ID
      //console.log(bleTagData)
      const timestamp = Date.now();

      if (isValidJSON(bleTagData)) {
        const data = JSON.parse(bleTagData);
        const bleData = data.filter((ble) => { return ble.Format !== "Gateway" });
        // const bleMobileDevice = data.filter((ble)=>{return ble.BLEMAC ==='30BB7DEB0DD9' || ble.BLEMAC ==='009CC0FF6DEA'});
        // if(bleMobileDevice.length>0)
        // {
        //   console.log(bleMobileDevice)
        // }

        if (bleData.length > 0) {
          for (let i = 0; i < bleData.length; i++) {
            const bleDeviceId = bleData[i].BLEMAC;           

            const RSSI = bleData[i].RSSI;
            //console.log(RSSI)

            if (RSSI >= minRSSI && RSSI <= maxRSSI) {
              const students = await Student.aggregate([
                // Step 1: Filter Students by clientId and areaId
                {
                  $match: {
                    $and: [
                      { bleDeviceId: { $regex: bleDeviceId, $options: 'i' } },
                      { clientId: new mongoose.Types.ObjectId(clientId) }
                    ]
                  }
                },
                // Step 2: Lookup for the classRoom name (single areaId)
                {
                  $lookup: {
                    from: 'areas',
                    let: { localAreaId: '$classRoom' },  // Local variable for the classRoom
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $eq: ['$_id', '$$localAreaId']  // Match classRoom ObjectId
                          }
                        }
                      }
                    ],
                    as: 'classRoomDetails',  // Result field with area details
                  },
                },
                // Step 3: Lookup for authorizedAreas (array of ObjectIds)
                {
                  $lookup: {
                    from: 'areas',
                    let: { authorizedAreaIds: '$authorizedAreas' },  // Local variable for authorizedAreas
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $in: ['$_id', '$$authorizedAreaIds']  // Match ObjectIds in authorizedAreas array
                          }
                        }
                      }
                    ],
                    as: 'authorizedAreaDetails',  // Result field with multiple area names
                  },
                },
                // Step 4: Flatten the results
                {
                  $project: {
                    _id: 1,
                    studentRegistrationNo: 1,
                    studentName: 1,
                    bleDeviceId: 1,
                    rollNo: 1,
                    contact: 1,
                    address: 1,
                    classRoom: 1,
                    clientId: 1,
                    //authorizedAreas: 1,  // Keep the original authorizedAreas ObjectIds
                    authorizedAreas: {
                      $concatArrays: [
                        '$authorizedAreas', // Merge the original authorizedAreas array
                        [{ $ifNull: ['$classRoom', null] }], // Include classRoom ObjectId, default to null if not found
                      ],
                    },
                    classRoomName: { $arrayElemAt: ['$classRoomDetails.name', 0] },  // Get classRoom name (single value)
                    authorizedAreaNames: { $concatArrays: ['$authorizedAreaDetails.name', '$classRoomDetails.name'] },  // Authorized areas' names
                  },
                },
              ]);

              //console.log(students);
              if (!students) return;

              if (students.length > 0) {
                //console.log(students[0].authorizedAreas);

                insertAttendance(gatewayMacId, areaId, areaName, clientId, students[0]);

              }

            }

          }
        }
      }
    }
  } catch (error) {
    console.error('Error handling MQTT publish:', error);
  }
}

// Utility function to check if a string is valid JSON
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
}


async function insertAttendance(gatewayMacId, areaId, areaName, client, student) {
 
  const clientId = new mongoose.Types.ObjectId(client);
  const today = moment().startOf('day');
  const now = moment();
  const studentId = new mongoose.Types.ObjectId(student._id);
  const deviceId = student.bleDeviceId;

  try {
    // Fetch school configuration
    const school = await School.findOne({ clientId });
    if (!school) {
      console.error(`School configuration not found for clientId: ${clientId}`);
      return;
    }

    // Extract school settings
    const {
      schoolStartAt,
      schoolEndAt,
      absenceTimeout,
      classroomPresenceTimeout,
      unauthorizedZoneTimeout,
      duplicateDetectionTimeout = 300, // Default to 300 seconds (5 minutes)
    } = school;

    const schoolStartTime = moment(schoolStartAt, 'HH:mm A');
    const schoolEndTime = moment(schoolEndAt, 'HH:mm A');
    const schoolStartBuffer = schoolStartTime.clone().add(absenceTimeout, 'minutes');
    const classroomTimeoutMs = classroomPresenceTimeout * 1000; // in milliseconds
    const unauthorizedTimeoutMs = unauthorizedZoneTimeout * 60000; // in milliseconds
    const duplicateTimeoutMs = duplicateDetectionTimeout * 1000; // in milliseconds

    // Ignore detections outside school hours
    if (now.isBefore(schoolStartTime) || now.isAfter(schoolEndTime)) {
      console.log('Detection outside school hours. Ignored.');
      return;
    }

    // Fetch today's attendance records for the student
    const existingAttendance = await Attendance.find({
      studentId,
      createdAt: { $gte: today.toDate(), $lte: today.endOf('day').toDate() },
    });

    const hasStatus = (status) => existingAttendance.some((att) => att.attendanceStatus === status);

    // Check for duplicate detections
    const lastAttendanceForArea = existingAttendance.find(
      (att) => att.areaId.toString() === areaId.toString()
    );
    if (lastAttendanceForArea) {
      const lastDetectionTime = moment(lastAttendanceForArea.lastDetectionTime);
      if (now.diff(lastDetectionTime, 'milliseconds') <= duplicateTimeoutMs) {
        console.log(
          `Duplicate detection ignored for student ${studentId} in area ${areaName}.`
        );
        return;
      }
    }

    // Handle "Arrived" status
    if (!hasStatus('Arrived') && areaName === 'Reception') {
      await markAttendance(studentId, clientId, 'Arrived', areaName, areaId, deviceId, 'Authorized');
      console.log('Student marked as Arrived.');
      return;
    }

    // Handle "Present" status
    if (!hasStatus('Present') && !hasStatus('Absent') && areaId === student.classRoom.toString()) {
      const lastSeenTime = getLastDetectionTime(existingAttendance, student.classRoomName) || now.toDate();
      if (now.diff(moment(lastSeenTime), 'milliseconds') > classroomTimeoutMs) {
        await markAttendance(studentId, clientId, 'Present', areaName, areaId, deviceId, 'Authorized');
        console.log('Student marked as Present.');
        return;
      }
    }

    // Handle "Absent" status
    if (!hasStatus('Absent') && !hasStatus('Present') && now.isAfter(schoolStartBuffer)) {
      const attendanceStatus = student.age > 2 ? 'Absent' : 'Present';
      await markAttendance(studentId, clientId, attendanceStatus, areaName, areaId, deviceId, 'Authorized');
      console.log(`Student marked as ${attendanceStatus} due to no detection.`);
      return;
    }

    // Handle unauthorized zone detection
    if (!student.authorizedAreas.includes(new mongoose.Types.ObjectId(areaId))) {
      const lastDetectionTime = getLastDetectionTime(existingAttendance) || now.toDate();
      if (now.diff(moment(lastDetectionTime), 'milliseconds') > unauthorizedTimeoutMs) {
        await markAttendance(
          studentId,
          clientId,
          existingAttendance[0]?.attendanceStatus || 'Unknown',
          areaName,
          areaId,
          deviceId,
          'UnAuthorized'
        );
        console.log(`Alert! Student ${studentId} detected in an unauthorized area.`);
        // await sendUnauthorizedZoneAlert(student, areaName); // Uncomment when ready
      }
    }
  } catch (error) {
    console.error(`Error inserting attendance for student ${studentId}:`, error.message);
  }
}

// Helper Function: Mark Attendance
async function markAttendance(studentId, clientId, status, areaName, areaId, deviceId, areaType) {
  try {
    await Attendance.create({
      studentId,
      clientId,
      attendanceStatus: status,
      areaName,
      areaType,
      areaId,
      lastDetectionTime: moment().toDate(),
      deviceId,
    });
    console.log(`Attendance marked: ${status} for student ${studentId}`);
  } catch (error) {
    console.error(`Error marking attendance for student ${studentId}:`, error.message);
  }
}

// Helper Function: Get Last Detection Time
function getLastDetectionTime(attendanceRecords, areaName = null) {
  if (areaName) {
    const record = attendanceRecords.find((att) => att.areaName === areaName);
    return record?.lastDetectionTime;
  }
  return attendanceRecords?.[0]?.lastDetectionTime;
}

async function sendUnauthorizedZoneAlert(student, areaName) {
  try {


    // Email options
    const mailOptions = {
      from: 'reachus@elmntx.com', // Replace with your sender details
      to: `${student.email}`, // Replace with the recipient's email
      subject: 'Unauthorized Zone Alert',
      text: `Student ${student.StudentName} (ID: ${student.bleDeviceId}) was detected in an unauthorized zone: ${areaName}.`,
      html: `<p><strong>Alert!</strong></p>
             <p>Student <strong>${student.StudentName}</strong> (ID: ${student.bleDeviceId}) was detected in an unauthorized zone: <strong>${areaName}</strong>.</p>`,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

module.exports = { aedes };




