const express = require('express');
const Gateway = require('../models/Gateway');
const Area = require('../models/Area');
const mongoose = require('mongoose');
const router = express.Router();


router.post('/create', async (req, res) => {
  const { macAddress, minRSSI, maxRSSI, areaId, clientId, status } = req.body;

  try {
    // Check if the Area exists by Area Name
    let gateway = await Gateway.findOne({ macAddress });

    if (gateway) {
      // If user exists, update their information
      gateway.macAddress = macAddress || area.macAddress;
      gateway.minRSSI = minRSSI || area.minRSSI;
      gateway.maxRSSI = maxRSSI || area.maxRSSI;
      gateway.areaId = areaId || area.areaId;
      gateway.clientId = clientId || area.clientId;
      gateway.status = status || gateway.status;

      const updatedGateway = await gateway.save();
      return res.status(200).json({
        message: 'Gateway updated successfully!',
        area: updatedGateway,
      });
    } else {
      // If user doesn't exist, create a new one
      const newGateway = new Gateway({
        macAddress,
        minRSSI,
        maxRSSI,
        areaId,
        clientId,
        status,
      });

      const savedGateway = await newGateway.save();
      return res.status(201).json({
        message: 'Gateway created successfully!',
        area: savedGateway,
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error creating or updating Gateway', details: err.message });
  }
});


router.post('/update-status', async (req, res) => {
  const { macAddress, clientId, status } = req.body;

  if (!macAddress || !clientId || !status) {
    return res.status(400).json({ message: 'MACAddress, areaId, clientId, and status are required.' });
  }

  try {
    // Find the gateway by macaddress , areaId and clientId and update the status
    const updatedGateway = await Gateway.findOneAndUpdate(
      { macAddress: macAddress, clientId: clientId }, // Search criteria
      { status: status },                 // Update fields
      { new: true }                       // Return the updated document
    );

    if (!updatedGateway) {
      return res.status(404).json({ message: 'Gateway not found.' });
    }

    return res.status(200).json({ message: 'Status updated successfully.', data: updatedGateway });
  } catch (error) {
    console.error('Error updating status:', error);
    return res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
});


// Route to search for Gateways by partial MACAddress 
router.get('/search', async (req, res) => {
  const { query, clientId } = req.query; // Get the search query from query params

  if (!query || query.trim() === '') {
    gateways = await Gateway.aggregate([
      {
        $match: {
          $and: [
            { clientId:  new mongoose.Types.ObjectId(clientId)  } // Match the specific clientId
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
          connectedStatus:'$connectedStatus',
          areaId: '$areaId',
          areaName: '$areaDetails.name' // Pull only the name of the area
        }
      }
    ]);
    res.status(200).json({
      message: 'Gateways found successfully!',
      gateways,
    });
    return;
  }

  try {
    // Use $regex for partial matching in name or email
    const gateways = await Gateway.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { macAddress: { $regex: query, $options: 'i' } }
              ]
            },
            { clientId:  new mongoose.Types.ObjectId(clientId)  } // Match the specific clientId
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
          connectedStatus:'$connectedStatus',
          areaId: '$areaId',
          areaName: '$areaDetails.name' // Pull only the name of the area
        }
      }
    ]);
    // await Gateway.find({
    //     $and: [
    //         {
    //             $or: [
    //                 { macAddress: { $regex: query, $options: 'i' } }
    //             ]
    //         },
    //         { clientId: clientId } // Match the specific clientId
    //     ]
    // });
    if (gateways.length === 0) {
      return res.status(404).json({ message: 'No Gateways found matching the search query' });
    }

    res.status(200).json({
      message: 'Gateways found successfully!',
      gateways,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error searching for Gateways', details: err.message });
  }
});


// Route to get all Gateways
router.get('/', async (req, res) => {
  try {
    // console.log(req);
    const { clientId } = req.query;
    const gateways = await Gateway.aggregate([
      {
        $match: { clientId: new mongoose.Types.ObjectId(clientId) } // Filter Gateways by clientId
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
          macAddress: '$macAddress', // Assuming the gateway's name is stored in 'name'
          minRSSI: '$minRSSI',
          maxRSSI: '$maxRSSI',
          status: '$status',
          connectedStatus:'$connectedStatus',
          areaId: '$areaId',
          areaName: '$areaDetails.name' // Pull only the name of the area
        }
      }
    ]);//Gateway.find({clientId}); // Fetch all areas
    res.status(200).json(gateways);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching gateways', details: error.message });
  }
});



module.exports = router;