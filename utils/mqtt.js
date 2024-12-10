const aedes = require('aedes')();
const moment = require('moment');
const mongoose = require('mongoose');
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

      //   const school = await School.findById(clientId);
      //   if (!school) return;


      //   // Load timeout settings dynamically
      // const now = moment();
      // const schoolStartTime = moment(school.startTime, "HH:mm");
      // const schoolEndTime = moment(school.endTime, "HH:mm");

      // const classroomPresenceTimeout = school.classroomPresenceTimeout || 30000; // Default: 30 seconds
      // const absenceTimeout = school.absenceTimeout || 1800000; // Default: 30 minutes
      // const lateDetectionTimeout = school.lateDetectionTimeout || 2100000; // Default: 35 minutes
      // const unauthorizedZoneTimeout = school.unauthorizedZoneTimeout || 300000; // Default: 5 minutes
      // const sensitiveAreaTimeout = school.sensitiveAreaTimeout || 300000; // Default: 5 minutes


      const bleTagData = packet.payload.toString();  // BLE tag ID
      const timestamp = Date.now();

      if (isValidJSON(bleTagData)) {
        const data = JSON.parse(bleTagData);
        const bleData = data.filter((ble) => { return ble.Format !== "Gateway" });

        if (bleData.length > 0) {
          for (let i = 0; i < bleData.length; i++) {
            const bleDeviceId = bleData[i].BLEMAC;
            const RSSI = bleData[i].RSSI;


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

async function insertAttendance(gatewayMacId, areaId, areaName, clientId, student) {
  try {
    // Get the current date without time for comparison
    const today = moment().startOf('day');
    const studentId = student.bleDeviceId;
    const stuRollNo = student.rollNo;
    // Check if the student already has "Arrived" or "Present" for the day
    const existingAttendance = await Attendance.findOne({
      studentId: studentId,
      attendanceStatus: { $in: ['Arrived', 'Present'] },
      createdAt: { $gte: today.toDate(), $lte: moment(today).endOf('day').toDate() },
    });

    if (existingAttendance) {
      // Skip if the attendance status is "Arrived" or "Present" for today
      if (attendanceStatus === existingAttendance.attendanceStatus) {
        console.log(
          `Skipping attendance update for ${attendanceStatus} since it already exists for today.`
        );
        return;
      }
    }

    // Handle instant arrival at reception
    if (areaName === 'Reception' && !existingAttendance) {
      // Insert other statuses or new authorized area attendance
      const newAttendance = new Attendance({
        studentId,
        attendanceStatus,
        areaType,
        lastDetectionTime: new Date(),
        deviceId,
      });

      await newAttendance.save();
      console.log('Attendance record inserted successfully:', newAttendance);
    }


  } catch (error) {
    console.error('Error inserting attendance:', error);
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
