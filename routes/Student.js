const express = require('express');
const Student = require('../models/Student');
const mongoose = require('mongoose');
const router = express.Router();

// Create Student
router.post('/create', async (req, res) => {
  const { studentRegistrationNo, studentName, rollNo, classRoom, address, contact, bleDeviceId, clientId, authorizedAreas, status,dateOfBirth } = req.body;

  try {
    // Check if the student already exists by registration number
    let student = await Student.findOne({ studentRegistrationNo });

    if (student) {
      // Update student if already exists
      student.studentName = studentName || student.studentName;
      student.classRoom = classRoom || student.classRoom;
      student.address = address || student.address;
      student.contact.email = contact.email || student.contact.email;
      student.contact.phone = contact.phone || student.contact.phone;
      student.bleDeviceId = bleDeviceId || student.bleDeviceId;
      student.clientId = clientId || student.clientId;
      student.authorizedAreas = authorizedAreas || student.authorizedAreas;
      student.status = status || student.status;
      student.dateOfBirth = dateOfBirth || student.dateOfBirth;
      await student.save();
      return res.status(200).json({ message: 'Student updated successfully', student });
    } else {
      // Create a new student if doesn't exist
      student = new Student({
        studentRegistrationNo,
        studentName,
        rollNo,
        classRoom,
        address,
        contact,
        bleDeviceId,
        clientId,
        authorizedAreas,
        status,
        dateOfBirth
      });

      await student.save();
      return res.status(201).json({ message: 'Student created successfully', student });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { clientId, areaId } = req.query;

    // Build the match stage dynamically based on query params
    let matchStage = {};
    if (clientId) matchStage.clientId = new mongoose.Types.ObjectId(clientId);
    if (areaId) matchStage.classRoom = new mongoose.Types.ObjectId(areaId);

    console.log('Match Stage:', matchStage);

    const students = await Student.aggregate([
      // Step 1: Filter Students by clientId and areaId
      { $match: matchStage },

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
          //authorizedAreas: 1,  // Keep the original authorizedAreas ObjectIds
          authorizedAreas: {
            $concatArrays: [
              '$authorizedAreas', // Merge the original authorizedAreas array
              [{ $ifNull: ['$classRoom', null] }], // Include classRoom ObjectId, default to null if not found
            ],
          },
          classRoomName: { $arrayElemAt: ['$classRoomDetails.name', 0] },  // Get classRoom name (single value)
          authorizedAreaNames: { $concatArrays: ['$authorizedAreaDetails.name', '$classRoomDetails.name'] },  // Authorized areas' names
          status:1,
          dateOfBirth:1,
          age:1
        },
      },
    ]);

    // Check if no students are found
    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'No students found matching the criteria' });
    }

    res.status(200).json(students);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      error: 'Error fetching students',
      details: error.message,
    });
  }
});


router.get('/search', async (req, res) => {
  const { query, clientId, areaId } = req.query; // Get the search query from query params
  let matchStage = {};
  if (clientId) matchStage.clientId = new mongoose.Types.ObjectId(clientId);
    if (areaId) matchStage.classRoom = new mongoose.Types.ObjectId(areaId);
  if (!query || query.trim() === '') {
    // Build the match stage dynamically based on query params
    
    

    console.log('Match Stage:', matchStage);

    const students = await Student.aggregate([
      // Step 1: Filter Students by clientId and areaId
      { $match: matchStage },

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
          //authorizedAreas: 1,  // Keep the original authorizedAreas ObjectIds
          authorizedAreas: {
            $concatArrays: [
              '$authorizedAreas', // Merge the original authorizedAreas array
              [{ $ifNull: ['$classRoom', null] }], // Include classRoom ObjectId, default to null if not found
            ],
          },
          classRoomName: { $arrayElemAt: ['$classRoomDetails.name', 0] },  // Get classRoom name (single value)
          authorizedAreaNames: { $concatArrays: ['$authorizedAreaDetails.name', '$classRoomDetails.name'] },  // Authorized areas' names
          status:1,
          dateOfBirth:1,
          age:1
        },
      },
    ]);
    res.status(200).json({
      message: 'Students found successfully!',
      students,
    });
    return;
  }

  try {
    console.log('Match Stage:', matchStage);
    // Use $regex for partial matching in name or email
    const students = await Student.aggregate([
      // Step 1: Filter Students by clientId and areaId
      {
        $match: {
          $and: [
            {
              $or: [                
                { studentRegistrationNo: { $regex: query, $options: 'i' }},
                { studentName: { $regex: query, $options: 'i' }},
                { bleDeviceId: { $regex: query, $options: 'i' }},
                { 'contact.phone': { $regex: query, $options: 'i' } }, // Correctly reference nested field
                { 'contact.email': { $regex: query, $options: 'i' } }, // Correctly reference nested field
                { studentName: { $regex: query, $options: 'i' }}
              ]
            },
            matchStage
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
          //authorizedAreas: 1,  // Keep the original authorizedAreas ObjectIds
          authorizedAreas: {
            $concatArrays: [
              '$authorizedAreas', // Merge the original authorizedAreas array
              [{ $ifNull: ['$classRoom', null] }], // Include classRoom ObjectId, default to null if not found
            ],
          },
          classRoomName: { $arrayElemAt: ['$classRoomDetails.name', 0] },  // Get classRoom name (single value)
          authorizedAreaNames: { $concatArrays: ['$authorizedAreaDetails.name', '$classRoomDetails.name'] },  // Authorized areas' names
          status:1,
          dateOfBirth:1,
          age:1
        },
      },
    ]);
    if (students.length === 0) {
      return res.status(404).json({ message: 'No Gateways found matching the search query',
        students});
    }

    res.status(200).json({
      message: 'Students found successfully!',
      students,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error searching for Students', details: err.message });
  }
});

router.post('/update-status', async (req, res) => {
  const { studentRegistrationNo, clientId, status } = req.body;

  if (!studentRegistrationNo || !clientId || !status) {
    return res.status(400).json({ message: 'studentRegistrationNo,  clientId, and status are required.' });
  }

  try {
    // Find the gateway by macaddress , areaId and clientId and update the status
    const updatedStudent = await Student.findOneAndUpdate(
      { studentRegistrationNo: studentRegistrationNo, clientId: clientId }, // Search criteria
      { status: status },                 // Update fields
      { new: true }                       // Return the updated document
    );

    if (!updatedStudent) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    return res.status(200).json({ message: 'Status updated successfully.', data: updatedStudent });
  } catch (error) {
    console.error('Error updating status:', error);
    return res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
});


router.post('/getStudentByRegId', async (req, res) => {
  const { id } = req.params;

  try {
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.status(200).json(student);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

});

module.exports = router;
