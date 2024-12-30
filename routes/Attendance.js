const express = require('express');
const mongoose = require('mongoose');
const moment = require('moment');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Area = require('../models/Area');
const router = express.Router();
router.get('/today', async (req, res) => {
    console.log(req.query)
    const { query, clientId, deviceId, studentId } = req.query; // Get the search query from query params

    try {
        const todayStart = moment().startOf('day').toDate();
        const todayEnd = moment().endOf('day').toDate();


        // Build dynamic match object, excluding 'null', undefined, or empty string
        const matchCriteria = {
            clientId: clientId && clientId !== 'null' ? new mongoose.Types.ObjectId(clientId) : undefined,
            ...(query && query !== 'null' && { classRoom: new mongoose.Types.ObjectId(query) }),
          };
          
          // Add `$or` only if `deviceId` or `studentId` are valid
          const orConditions = [];
          if (deviceId && deviceId !== 'null') {
            orConditions.push({ bleDeviceId: { $regex: deviceId, $options: 'i' } });
          }
          if (studentId && studentId !== 'null') {
            orConditions.push({ studentRegistrationNo: { $regex: studentId, $options: 'i' } });
          }
          
          if (orConditions.length > 0) {
            matchCriteria.$or = orConditions;
          }
          
          // Remove undefined fields from matchCriteria
          Object.keys(matchCriteria).forEach((key) => {
            if (matchCriteria[key] === undefined) {
              delete matchCriteria[key];
            }
          });

        console.log(matchCriteria)
        const attendanceData = await Student.aggregate([
            // Match Students with Specific Client ID and Optional ClassRoom ID
            {
                $match: matchCriteria, // Apply dynamic match criteria
            },
            // Lookup Attendance Data
            {
                $lookup: {
                    from: "attendances",
                    let: { studentId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$studentId", "$$studentId"] }, // Match by student ID
                                        { $gte: ["$createdAt", todayStart] },   // Filter today's attendance
                                        { $lte: ["$createdAt", todayEnd] }
                                    ]
                                }
                            }
                        },
                        {
                            $sort: { lastDetectionTime: -1 } // Sort attendance records by lastDetectionTime descending
                        }
                    ],
                    as: "attendanceRecords"
                }
            },
            {
                $unwind: {
                    path: "$attendanceRecords",
                    preserveNullAndEmptyArrays: true // Include students without attendance records
                }
            },
            // Group by Student ID and Pick Latest Attendance Record
            {
                $group: {
                    _id: "$_id",
                    studentInfo: { $first: "$$ROOT" }, // Keep complete student data
                    latestAttendance: { $first: "$attendanceRecords" } // Keep only the latest attendance record
                }
            },
            // Lookup Classroom Details
            {
                $lookup: {
                    from: "areas",
                    localField: "studentInfo.classRoom",
                    foreignField: "_id",
                    as: "classRoomDetails"
                }
            },
            {
                $unwind: {
                    path: "$classRoomDetails",
                    preserveNullAndEmptyArrays: true // Include students without classroom details
                }
            },
            // Lookup Authorized Areas Details
            {
                $lookup: {
                    from: "areas",
                    localField: "studentInfo.authorizedAreas",
                    foreignField: "_id",
                    as: "authorizedAreasDetails"
                }
            },
            // Project Complete Student Info and Latest Attendance Data
            {
                $project: {
                    _id: 1,
                    studentId: "$_id",
                    studentName: "$studentInfo.studentName",
                    studentRegistrationNo: "$studentInfo.studentRegistrationNo",
                    dateOfBirth: "$studentInfo.dateOfBirth",
                    age: "$studentInfo.age",
                    rollNo: "$studentInfo.rollNo",
                    address: "$studentInfo.address",
                    contact: "$studentInfo.contact",
                    bleDeviceId: "$studentInfo.bleDeviceId",
                    classRoom: "$classRoomDetails.name",
                    classRoomareaid: "$classRoomDetails._id",
                    authorizedAreas: "$authorizedAreasDetails.name",
                    attendanceStatus: { $ifNull: ["$latestAttendance.attendanceStatus", "No Attendance"] },
                    areaName: "$latestAttendance.areaName",
                    areaType: "$latestAttendance.areaType",
                    lastDetectionTime: "$latestAttendance.lastDetectionTime",
                    deviceId: "$latestAttendance.deviceId",
                    clientId: "$studentInfo.clientId",
                    status: "$studentInfo.status",
                    createdAt: "$studentInfo.createdAt",
                    updatedAt: "$studentInfo.updatedAt"
                }
            }
        ]);

        res.json({ success: true, data: attendanceData });
    } catch (error) {
        console.error('Error fetching attendance data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance data' });
    }
});



router.post('/attendance', async (req, res) => {
    const { fromDate, toDate, clientId,areaId ,query, pageSize = 10, pageNo = 1 } = req.body;

    try {
        // Parse and validate dates
        const start = fromDate ? moment(fromDate, 'YYYY-MM-DD').startOf('day').toDate() : null;
        const end = toDate ? moment(toDate, 'YYYY-MM-DD').endOf('day').toDate() : null;

        

        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'Invalid fromDate or toDate provided.' });
        }

        // Build match criteria
        const matchCriteria = {
            createdAt: { $gte: start, $lte: end },
            ...(clientId && { clientId: new mongoose.Types.ObjectId(clientId) })
        };

        // Calculate pagination values
        const limit = parseInt(pageSize);
        const skip = (parseInt(pageNo) - 1) * limit;

        // Aggregation pipeline
        const pipeline = [
            // Match attendance records
            { $match: matchCriteria },
            // Lookup student details
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentId',
                    foreignField: '_id',
                    as: 'studentDetails',
                }
            },
            { $unwind: { path: '$studentDetails', preserveNullAndEmptyArrays: true } },
            ...(query || areaId
                ? [{
                    $match: {
                        ...(areaId && { "studentDetails.classRoom": new mongoose.Types.ObjectId(areaId) }),
                        ...(query && {
                            $or: [
                                { deviceId: { $regex: query, $options: 'i' } },
                                { "studentDetails.studentRegistrationNo": { $regex: query, $options: 'i' } },
                            ]
                        }),
                    }
                }]
                : []),
            // Lookup authorized area details
            {
                $lookup: {
                    from: 'areas',
                    localField: 'studentDetails.authorizedAreas',
                    foreignField: '_id',
                    as: 'authorizedAreas',
                }
            },
            { $unwind: { path: '$authorizedAreas', preserveNullAndEmptyArrays: true } },
            // Lookup attendance area details
            {
                $lookup: {
                    from: 'areas',
                    localField: 'areaId',
                    foreignField: '_id',
                    as: 'attendanceArea',
                }
            },
            { $unwind: { path: '$attendanceArea', preserveNullAndEmptyArrays: true } },
            // Check if the area is authorized
            {
                $addFields: {
                    isAuthorized: {
                        $cond: [
                            {
                                $or: [
                                    { $in: ['$attendanceArea._id', { $ifNull: ['$studentDetails.authorizedAreas', []] }] },
                                    { $eq: ['$attendanceArea._id', '$studentDetails.classRoom'] },
                                    { $in: ['$attendanceArea.name', ['Reception', 'Exit']] }
                                ]
                            },
                            'Authorized',
                            'Unauthorized'
                        ]
                    }
                }
            },
            // Sort, paginate, and project final fields
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    _id: 1,
                    studentId: 1,
                    studentName: '$studentDetails.studentName',
                    studentRegistrationNo: '$studentDetails.studentRegistrationNo',
                    classRoom: '$studentDetails.classRoom',
                    address: '$studentDetails.address',
                    contact: '$studentDetails.contact',
                    attendanceStatus: 1,
                    areaName: '$attendanceArea.name',
                    areaType: '$attendanceArea.type',
                    isAuthorized: 1,
                    authorizedAreas: '$authorizedAreas.name',
                    deviceId: 1,
                    createdAt: 1,
                    lastDetectionTime:1
                }
            }
        ];

        // Get total count for pagination
        const totalCountPipeline = [// Match attendance records
            { $match: matchCriteria },
            // Lookup student details
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentId',
                    foreignField: '_id',
                    as: 'studentDetails',
                }
            },
            { $unwind: { path: '$studentDetails', preserveNullAndEmptyArrays: true } },
            ...(query || areaId
                ? [{
                    $match: {
                        ...(areaId && { "studentDetails.classRoom": new mongoose.Types.ObjectId(areaId) }),
                        ...(query && {
                            $or: [
                                { deviceId: { $regex: query, $options: 'i' } },
                                { "studentDetails.studentRegistrationNo": { $regex: query, $options: 'i' } },
                            ]
                        }),
                    }
                }]
                : []),
            // Lookup authorized area details
            {
                $lookup: {
                    from: 'areas',
                    localField: 'studentDetails.authorizedAreas',
                    foreignField: '_id',
                    as: 'authorizedAreas',
                }
            },
            { $unwind: { path: '$authorizedAreas', preserveNullAndEmptyArrays: true } },
            // Lookup attendance area details
            {
                $lookup: {
                    from: 'areas',
                    localField: 'areaId',
                    foreignField: '_id',
                    as: 'attendanceArea',
                }
            },
            { $unwind: { path: '$attendanceArea', preserveNullAndEmptyArrays: true } },
            // Check if the area is authorized
            {
                $addFields: {
                    isAuthorized: {
                        $cond: [
                            {
                                $or: [
                                    { $in: ['$attendanceArea._id', { $ifNull: ['$studentDetails.authorizedAreas', []] }] },
                                    { $eq: ['$attendanceArea._id', '$studentDetails.classRoom'] },
                                    { $in: ['$attendanceArea.name', ['Reception', 'Exit']] }
                                ]
                            },
                            'Authorized',
                            'Unauthorized'
                        ]
                    }
                }
            },
            // Sort, paginate, and project final fields
            { $sort: { createdAt: -1 } },
            //{ $skip: skip },
            //{ $limit: limit },
            {
                $project: {
                    _id: 1,
                    studentId: 1,
                    studentName: '$studentDetails.studentName',
                    studentRegistrationNo: '$studentDetails.studentRegistrationNo',
                    classRoom: '$studentDetails.classRoom',
                    address: '$studentDetails.address',
                    contact: '$studentDetails.contact',
                    attendanceStatus: 1,
                    areaName: '$attendanceArea.name',
                    areaType: '$attendanceArea.type',
                    isAuthorized: 1,
                    authorizedAreas: '$authorizedAreas.name',
                    deviceId: 1,
                    createdAt: 1,
                    lastDetectionTime:1
                }
            }, { $count: 'total' }];
        const totalCountResult = await Attendance.aggregate(totalCountPipeline);
        const totalRecords = totalCountResult.length > 0 ? totalCountResult[0].total : 0;

        // Execute pipeline
        const attendanceData = await Attendance.aggregate(pipeline);

        res.json({
            success: true,
            data: attendanceData,
            pagination: {
                totalRecords,
                pageNo: parseInt(pageNo),
                pageSize: parseInt(pageSize),
                totalPages: Math.ceil(totalRecords / pageSize),
            }
        });
    } catch (error) {
        console.error('Error fetching attendance data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance data' });
    }
});


router.post('/todaystudenttrack', async (req, res) => {
    const { fromDate, toDate, clientId ,deviceId,studentId, pageSize = 10, pageNo = 1 } = req.body;

    try {
        // Parse and validate dates
        const start = fromDate ? moment(fromDate, 'YYYY-MM-DD').startOf('day').toDate() : null;
        const end = toDate ? moment(toDate, 'YYYY-MM-DD').endOf('day').toDate() : null;

        

        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'Invalid fromDate or toDate provided.' });
        }

        // Build match criteria
        const matchCriteria = {
            createdAt: { $gte: start, $lte: end },
            ...(clientId && { clientId: new mongoose.Types.ObjectId(clientId) })
        };

        // Calculate pagination values
        const limit = parseInt(pageSize);
        const skip = (parseInt(pageNo) - 1) * limit;

        // Aggregation pipeline
        const pipeline = [
            // Match attendance records
            { $match: matchCriteria },
            // Lookup student details
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentId',
                    foreignField: '_id',
                    as: 'studentDetails',
                }
            },
            { $unwind: { path: '$studentDetails', preserveNullAndEmptyArrays: true } },
            ...(deviceId || deviceId
                ? [{
                    $match: {
                      //  ...(deviceId && { "studentDetails.classRoom":  { $regex: query, $options: 'i' } }),
                        ...(deviceId && {
                            $or: [
                                { deviceId: { $regex: deviceId, $options: 'i' } },
                                { "studentDetails.studentRegistrationNo": { $regex: studentId, $options: 'i' } },
                            ]
                        }),
                    }
                }]
                : []),
            // Lookup authorized area details
            {
                $lookup: {
                    from: 'areas',
                    localField: 'studentDetails.authorizedAreas',
                    foreignField: '_id',
                    as: 'authorizedAreas',
                }
            },
            { $unwind: { path: '$authorizedAreas', preserveNullAndEmptyArrays: true } },
            // Lookup attendance area details
            {
                $lookup: {
                    from: 'areas',
                    localField: 'areaId',
                    foreignField: '_id',
                    as: 'attendanceArea',
                }
            },
            { $unwind: { path: '$attendanceArea', preserveNullAndEmptyArrays: true } },
            // Check if the area is authorized
            {
                $addFields: {
                    isAuthorized: {
                        $cond: [
                            {
                                $or: [
                                    { $in: ['$attendanceArea._id', { $ifNull: ['$studentDetails.authorizedAreas', []] }] },
                                    { $eq: ['$attendanceArea._id', '$studentDetails.classRoom'] },
                                    { $in: ['$attendanceArea.name', ['Reception', 'Exit']] }
                                ]
                            },
                            'Authorized',
                            'Unauthorized'
                        ]
                    }
                }
            },
            // Sort, paginate, and project final fields
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    _id: 1,
                    studentId: 1,
                    studentName: '$studentDetails.studentName',
                    studentRegistrationNo: '$studentDetails.studentRegistrationNo',
                    classRoom: '$studentDetails.classRoom',
                    address: '$studentDetails.address',
                    contact: '$studentDetails.contact',
                    attendanceStatus: 1,
                    areaName: '$attendanceArea.name',
                    areaType: '$attendanceArea.type',
                    isAuthorized: 1,
                    authorizedAreas: '$authorizedAreas.name',
                    deviceId: 1,
                    createdAt: 1,
                    lastDetectionTime:1
                }
            }
        ];

        // Get total count for pagination
        const totalCountPipeline = [// Match attendance records
            { $match: matchCriteria },
            // Lookup student details
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentId',
                    foreignField: '_id',
                    as: 'studentDetails',
                }
            },
            { $unwind: { path: '$studentDetails', preserveNullAndEmptyArrays: true } },
            ...(deviceId || deviceId
                ? [{
                    $match: {
                        //...(areaId && { "studentDetails.classRoom": new mongoose.Types.ObjectId(areaId) }),
                        ...(deviceId && {
                            $or: [
                                { deviceId: { $regex: deviceId, $options: 'i' } },
                                { "studentDetails.studentRegistrationNo": { $regex: studentId, $options: 'i' } },
                            ]
                        }),
                    }
                }]
                : []),
            // Lookup authorized area details
            {
                $lookup: {
                    from: 'areas',
                    localField: 'studentDetails.authorizedAreas',
                    foreignField: '_id',
                    as: 'authorizedAreas',
                }
            },
            { $unwind: { path: '$authorizedAreas', preserveNullAndEmptyArrays: true } },
            // Lookup attendance area details
            {
                $lookup: {
                    from: 'areas',
                    localField: 'areaId',
                    foreignField: '_id',
                    as: 'attendanceArea',
                }
            },
            { $unwind: { path: '$attendanceArea', preserveNullAndEmptyArrays: true } },
            // Check if the area is authorized
            {
                $addFields: {
                    isAuthorized: {
                        $cond: [
                            {
                                $or: [
                                    { $in: ['$attendanceArea._id', { $ifNull: ['$studentDetails.authorizedAreas', []] }] },
                                    { $eq: ['$attendanceArea._id', '$studentDetails.classRoom'] },
                                    { $in: ['$attendanceArea.name', ['Reception', 'Exit']] }
                                ]
                            },
                            'Authorized',
                            'Unauthorized'
                        ]
                    }
                }
            },
            // Sort, paginate, and project final fields
            { $sort: { createdAt: -1 } },
            //{ $skip: skip },
            //{ $limit: limit },
            {
                $project: {
                    _id: 1,
                    studentId: 1,
                    studentName: '$studentDetails.studentName',
                    studentRegistrationNo: '$studentDetails.studentRegistrationNo',
                    classRoom: '$studentDetails.classRoom',
                    address: '$studentDetails.address',
                    contact: '$studentDetails.contact',
                    attendanceStatus: 1,
                    areaName: '$attendanceArea.name',
                    areaType: '$attendanceArea.type',
                    isAuthorized: 1,
                    authorizedAreas: '$authorizedAreas.name',
                    deviceId: 1,
                    createdAt: 1,
                    lastDetectionTime:1
                }
            }, { $count: 'total' }];
        const totalCountResult = await Attendance.aggregate(totalCountPipeline);
        const totalRecords = totalCountResult.length > 0 ? totalCountResult[0].total : 0;

        // Execute pipeline
        const attendanceData = await Attendance.aggregate(pipeline);

        res.json({
            success: true,
            data: attendanceData,
            pagination: {
                totalRecords,
                pageNo: parseInt(pageNo),
                pageSize: parseInt(pageSize),
                totalPages: Math.ceil(totalRecords / pageSize),
            }
        });
    } catch (error) {
        console.error('Error fetching attendance data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance data' });
    }
});




module.exports = router;