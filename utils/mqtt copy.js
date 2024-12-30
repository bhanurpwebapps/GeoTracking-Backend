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


//const noble = require('noble');
const noble = require('@abandonware/noble');
const bleno = require('bleno');

noble.on('stateChange', (state) => {
  if (state === 'poweredOn') {
    console.log('Scanning for devices...');
    noble.startScanning();
  } else {
    console.log(`Bluetooth state: ${state}`);
    noble.stopScanning();
  }
});

noble.on('discover', (peripheral) => {
  // if (peripheral.advertisement.localName === DEVICE_NAME) {
  console.log(`Found device: ${peripheral.advertisement.localName}`);
  // noble.stopScanning();
  connectAndDiscover(peripheral);
  //}
});

function connectAndDiscover(peripheral) {
  peripheral.connect((error) => {
    if (error) {
      console.error('Connection error:', error);
      return;
    }
    console.log(`Connected to: ${peripheral.advertisement.localName}`);
    discoverServicesAndCharacteristics(peripheral);
  });
}

function discoverServicesAndCharacteristics(peripheral) {
  peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
    if (err) {
      console.error('Error discovering services/characteristics:', err);
      return;
    }

    console.log(`Services for device ${peripheral.id}:`);
    services.forEach((service) => {
      console.log(`- Service UUID: ${service.uuid}`);
      service.characteristics.forEach((characteristic) => {
        console.log(`  - Characteristic UUID: ${characteristic.uuid}`);
        console.log(`    Properties: ${characteristic.properties.join(', ')}`);
        //sendNotification(characteristic)
        // Define the BLE Service
        const notifyCharacteristic = new NotifyCharacteristic(characteristic.uuid);
        const notifyService = new bleno.PrimaryService({
          uuid: service.uuid,
          characteristics: [notifyCharacteristic],
        });

        // Start Advertising
        bleno.on('stateChange', (state) => {
          if (state === 'poweredOn') {
            console.log('Starting BLE advertising...');
            bleno.startAdvertising(peripheral.advertisement.localName, [service.uuid]);
          } else {
            console.log(`State changed to: ${state}`);
            bleno.stopAdvertising();
          }
        });

        // When advertising starts
        bleno.on('advertisingStart', (error) => {
          if (!error) {
            console.log('Advertising started successfully.');
            bleno.setServices([notifyService]);
          } else {
            console.error('Error starting advertising:', error);
          }
        });

      });
    });

    peripheral.disconnect(() => {
      console.log('Disconnected from device');
    });
  });
}

// Send a notification to the characteristic
function sendNotification(characteristic) {
  const message = 'Hello BLE Device!'; // Your notification message
  const buffer = Buffer.from(message, 'utf-8'); // Convert message to a Buffer

  characteristic.write(buffer, true, (error) => {
    if (error) {
      console.error('Error sending notification:', error);
    } else {
      console.log(`Notification sent: ${message}`);
    }
  });
}


function sendNotificationToDevice(deviceMacAddress) {
  noble.on('stateChange', (state) => {
    if (state === 'poweredOn') {
      noble.startScanning(); // Start scanning for Bluetooth devices
    } else {
      noble.stopScanning(); // Stop scanning if Bluetooth is powered off
    }
  });

  noble.on('discover', (peripheral) => {
    if (peripheral.address === deviceMacAddress) {
      console.log(`Device found: ${peripheral.advertisement.localName}`);

      // Once the device is found, connect to it
      peripheral.connect((err) => {
        if (err) {
          console.error('Error connecting to device:', err);
          return;
        }

        console.log('Connected to Bluetooth device');

        // Discover services and characteristics
        peripheral.discoverSomeServicesAndCharacteristics([], [], (err, services, characteristics) => {
          if (err) {
            console.error('Error discovering services and characteristics:', err);
            return;
          }

          // Find a specific characteristic to write to (replace with your target characteristic UUID)
          const targetCharacteristic = characteristics.find(c => c.uuid === 'your-characteristic-uuid');

          if (targetCharacteristic) {
            const notificationData = Buffer.from('Notification data'); // Customize the data to send
            targetCharacteristic.write(notificationData, false, (err) => {
              if (err) {
                console.error('Error sending notification:', err);
              } else {
                console.log('Notification sent to Bluetooth device');
              }

              // Disconnect after sending data
              peripheral.disconnect((err) => {
                if (err) {
                  console.error('Error disconnecting:', err);
                }
                console.log('Disconnected from device');
              });
            });
          }
        });
      });
    }
  });
}



// Notification Characteristic
class NotifyCharacteristic extends bleno.Characteristic {
  constructor(characteristicUUID) {
    super({
      uuid: characteristicUUID,
      properties: ['notify'],
    });
    this.updateValueCallback = null;
  }

  // Called when a mobile device subscribes
  onSubscribe(maxValueSize, updateValueCallback) {
    console.log('Mobile device subscribed to notifications.');
    this.updateValueCallback = updateValueCallback;

    // Send notifications periodically
    this.intervalId = setInterval(() => {
      const message = `Hello from Node.js at ${new Date().toLocaleTimeString()}`;
      const data = Buffer.from(message, 'utf-8');
      console.log(`Sending notification: ${message}`);
      this.updateValueCallback(data);
    }, 3000); // Send every 3 seconds
  }

  // Called when a mobile device unsubscribes
  onUnsubscribe() {
    console.log('Mobile device unsubscribed from notifications.');
    clearInterval(this.intervalId);
    this.updateValueCallback = null;
  }
}
