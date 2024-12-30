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
let deviceStatus = {};
mqttServer.listen(MQTT_PORT, () => console.log(`MQTT broker running on port ${MQTT_PORT}`));
// Create a transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // Replace with your email provider's SMTP host
  port: 465, // Replace with your SMTP port
  secure: true, // true for 465, false for other ports
  auth: {
    user: 'info@internationalhealthdialogue.com', // Replace with your email
    pass: 'wfraiymkvixlwath', // Replace with your email password
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
                {
                  $lookup: {
                    from: 'users',
                    let: { teacherId: { $arrayElemAt: ['$classRoomDetails.classteacher', 0] } }, // Extract classteacher from classRoomDetails
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $eq: ['$_id', '$$teacherId']  // Match classRoom ObjectId
                          }
                        }
                      }
                    ],
                    as: 'userDetails',  // Result field with area details
                  },
                },
                // Step 5: Flatten the results
                {
                  $project: {
                    _id: 1,
                    studentRegistrationNo: 1,
                    studentName: 1,
                    bleDeviceId: 1,
                    rollNo: 1,
                    dateOfBirth: 1,
                    age: 1,
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
                    userEmails: {
                      $reduce: {
                        input: {
                          $concatArrays: [
                            { $map: { input: '$userDetails', as: 'user', in: '$$user.email' } }, // User emails
                            [{ $ifNull: ['$contact.email', null] }] // Append student email
                          ]
                        },
                        initialValue: '',
                        in: {
                          $cond: {
                            if: { $eq: ['$$value', ''] }, // Check if it's the first item
                            then: '$$this', // Set the first item without a semicolon
                            else: { $concat: ['$$value', ';', '$$this'] } // Concatenate with semicolon
                          }
                        }
                      }
                    },
                    userPhones: {
                      $reduce: {
                        input: {
                          $concatArrays: [
                            { $map: { input: '$userDetails', as: 'user', in: '$$user.contactNumber' } }, // User phone numbers
                            [{ $ifNull: ['$contact.phone', null] }] // Append student contact number
                          ]
                        },
                        initialValue: '',
                        in: {
                          $cond: {
                            if: { $eq: ['$$value', ''] }, // Check if it's the first item
                            then: '$$this', // Set the first item without a semicolon
                            else: { $concat: ['$$value', ';', '$$this'] } // Concatenate with semicolon
                          }
                        }
                      }
                    },
                  },
                },
              ]);

              // console.log(students[0]?user);
              if (!students) return;

              if (students.length > 0) {
                //console.log(students[0].authorizedAreas);

                await insertAttendance(gatewayMacId, areaId, areaName, clientId, students[0]);

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
      console.error('School configuration not found.');
      return;
    }

    // Extract school settings
    const {
      schoolStartAt,
      schoolEndAt,
      absenceTimeout,
      classroomPresenceTimeout,
      unauthorizedZoneTimeout
    } = school;

    const schoolStartTime = moment(schoolStartAt, "HH:mm A");
    const schoolEndTime = moment(schoolEndAt, "HH:mm A");
    const schoolStartBuffer = schoolStartTime.add(absenceTimeout, 'minutes');
    const classroomTimeoutMs = classroomPresenceTimeout * 1000; // Convert to milliseconds
    const unauthorizedTimeoutMs = unauthorizedZoneTimeout * 60000; // Convert to milliseconds

    // Ignore detections outside school hours
    if (now.isBefore(schoolStartTime) || now.isAfter(schoolEndTime)) return;

    // Fetch today's attendance records for the student
    const existingAttendance = await Attendance.find({
      studentId,
      createdAt: { $gte: today.toDate(), $lte: today.endOf('day').toDate() },
    }).sort({ createdAt: -1 });

    const hasStatus = (status) => existingAttendance.some(att => att.attendanceStatus === status);

    // Get the latest attendance record
    const lastAttendance = existingAttendance[0];
    const lastStatus = lastAttendance?.attendanceStatus || null;
    const lastAreaId = lastAttendance?.areaId || null;
    // Check time difference
    //const timeDifference = moment().diff(moment(lastAttendance?.createdAt), 'minutes');

    // Handle "Arrived" status
    if (!hasStatus('Arrived') && areaName === 'Reception') {
      await markAttendance(student, studentId, clientId, 'Arrived', areaName, areaId, deviceId, 'Authorized');
      console.log('Student marked as Arrived.');
      sendUnauthorizedZoneAlert(student, areaName);
    }



    // Handle "Classroom" logic
    if (!hasStatus('Present') && !hasStatus('Absent')) {
      if (areaId === student.classRoom.toString()) {
        //if (areaId === lastAreaId) {
        if (!lastStatus || lastStatus !== 'Entered') {
          await markAttendance(student, studentId, clientId, 'Entered', areaName, areaId, deviceId, 'Authorized');
          console.log('Student marked as Entered in Classroom.');
          return;
        }

        const timeDifference = now.diff(moment(lastAttendance.createdAt), 'minutes');
        if (lastStatus === 'Entered' && timeDifference >= classroomPresenceTimeout) {
          await markAttendance(student, studentId, clientId, 'Present', areaName, areaId, deviceId, 'Authorized');
          console.log('Student marked as Present in Classroom.');
          return;
        }
        // }
      }
    }

    // Handle "Absent" status
    if (!hasStatus('Absent') && !hasStatus('Present') && now.isAfter(schoolStartBuffer) && areaId === student.classRoom.toString()) {
      const attendanceStatus = student.age > 2 ? 'Absent' : 'Present';
      await markAttendance(student, studentId, clientId, attendanceStatus, areaName, areaId, deviceId, 'Authorized');
      console.log(`Student marked as ${attendanceStatus} due to no detection.`);
      sendUnauthorizedZoneAlert(student, areaName);
    }



    // Handle "Exit" logic
    if (areaName === 'Exit') {

      //if (areaId === lastAreaId) {
      if (!lastStatus || lastStatus !== 'Entered') {
        await markAttendance(student, studentId, clientId, 'Entered', areaName, areaId, deviceId, 'Authorized');
        console.log('Student marked as Entered in Exit.');
        return;
      }

      const timeDifference = now.diff(moment(lastAttendance.createdAt), 'minutes');
      if (lastStatus === 'Entered' && timeDifference >= 2) {
        await markAttendance(student, studentId, clientId, 'Exited', areaName, areaId, deviceId, 'Authorized');
        console.log('Student marked as Exited.');
        return;
      }
      //}
    }

    // Check if the areaObjectId exists in the authorizedAreas array

    const isAuthorized = student.authorizedAreas.some((id) => id.equals(new mongoose.Types.ObjectId(areaId)));

    const status = isAuthorized ? 'Authorized' : 'UnAuthorized';
    if (status === 'UnAuthorized') {
      if (now.diff(getLastDetectionTime(existingAttendance) || now.toDate(), 'milliseconds') > unauthorizedZoneTimeout * 60000 && areaName !== 'Exit') {

        let attStatus;
        if (hasStatus('Present')) {
          attStatus = 'Present';
        }
        else if (hasStatus('Absent')) {
          attStatus = 'Absent';
        }
        else
        {
          attStatus=lastStatus;
        }

        await markAttendance(student, studentId, clientId, attStatus, areaName, areaId, deviceId, status);
        sendUnauthorizedZoneAlert(student, areaName);

      }
    }
    else {
      if (areaName !== 'Exit') {

        let attStatus;
        if (hasStatus('Present')) {
          attStatus = 'Present';
        }
        else if (hasStatus('Absent')) {
          attStatus = 'Absent';
        }
        else
        {
          attStatus=lastStatus;
        }

        await markAttendance(student, studentId, clientId, attStatus, areaName, areaId, deviceId, status);
      }
    }
    //console.log(`Alert! ${status} access detected.`);     
    //}
  } catch (error) {
    console.error('Error inserting attendance:', error);
  }
}

/**
 * Check if the student is still in the exit area.
 * This is a placeholder function. Implement logic to query recent detections for the student in the specified area.
 */
async function checkIfStillInExitArea(studentId, areaId) {
  const recentDetection = await Attendance.findOne({
    studentId,
    areaId,
    createdAt: { $gte: moment().subtract(1, 'minutes').toDate() },
  });
  return !!recentDetection;
}

// Get Last Detection Time
function getLastDetectionTime(attendanceRecords) {
  return attendanceRecords?.[0]?.lastDetectionTime;
}
// Helper function to mark attendance
async function markAttendance(student, studentId, clientId, status, areaName, areaId, deviceId, areaType) {
  try {
    const attObj = {
      studentId,
      clientId,
      attendanceStatus: status,
      areaName,
      areaType,
      areaId,
      lastDetectionTime: moment().toDate(),
      deviceId,
    }
    const today = moment().startOf('day').toDate();
    // Check if the last attendance has the same areaId
    const lastAttendance = await Attendance.findOne({
      deviceId,
      createdAt: { $gte: today }, // Today's records
    })
      .sort({ createdAt: -1 }) // Sort by the most recent record
      .lean();

    if (lastAttendance && lastAttendance.areaId.toString() === areaId.toString()) {
      console.log(`Skipping insertion: AreaId ${areaId} matches last record.`);
      return;
    }

    // Insert attendance if the areaId is different
    await Attendance.create(attObj);
    // if (areaType === "UnAuthorized") {
    //   sendUnauthorizedZoneAlert(student, areaName);
    // }

    console.log('Attendance record inserted:', attObj);

    deviceStatus[deviceId] = attObj;

    // Emit event via socket
    if (global.io) {
      global.io.emit('deviceLocation', attObj);
    }


  } catch (error) {
    console.error('Error marking attendance:', error);
  }
}

async function sendUnauthorizedZoneAlert(student, areaName) {
  try {
    console.log("Sent Email");
    return;
    // Email options
    const mailOptions = {
      from: 'reachus@elmntx.com', // Replace with your sender details
      to: `${student.userEmails}`, // Replace with the recipient's email
      subject: 'Unauthorized Zone Alert',
      text: `Student ${student.studentName} (ID: ${student.bleDeviceId}) was detected in an unauthorized zone: ${areaName}.`,
      html: `<p><strong>Alert!</strong></p>
             <p>Student <strong>${student.studentName}</strong> (ID: ${student.bleDeviceId}) was detected in an unauthorized zone: <strong>${areaName}</strong>.</p>`,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

module.exports = { aedes };




