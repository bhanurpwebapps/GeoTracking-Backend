const express = require('express');
const Area = require('../models/Area');
//const { authMiddleware } = require('./auth');
const router = express.Router();

// Create Area
router.get('/getAreaTypes', async (req, res) => {
  try {
    const field = Area.schema.path('type');
    res.status(201).json(field && field.enumValues ? field.enumValues : []);
  } catch (err) {
    res.status(400).json({ message: 'Error creating area', error: err });
  }
});


router.post('/create', async (req, res) => {
  const { name, type, clientId, status } = req.body;

  try {
      // Check if the Area exists by Area Name
      let area = await Area.findOne({ name });
  
      if (area) {
        // If user exists, update their information
        area.name = name || area.name;
        area.type = type || area.type;
        area.clientId = clientId || area.clientId;
        area.status = status || area.status;
  
        const updatedArea = await area.save();
        return res.status(200).json({
          message: 'Area updated successfully!',
          area: updatedArea,
        });
      } else {
        // If user doesn't exist, create a new one
        const newArea = new Area({
          name,
          type,
          clientId,
          status,
        });
  
        const savedArea = await newArea.save();
        return res.status(201).json({
          message: 'Area created successfully!',
          area: savedArea,
        });
      }
    } catch (err) {
      res.status(500).json({ error: 'Error creating or updating Area', details: err.message });
    }
});


router.post('/update-status', async (req, res) => {
  const { name, clientId, status } = req.body;

  if (!name || !clientId || !status) {
    return res.status(400).json({ message: 'Name, clientId, and status are required.' });
  }

  try {
    // Find the area by name and clientId and update the status
    const updatedArea = await Area.findOneAndUpdate(
      { name: name, clientId: clientId }, // Search criteria
      { status: status },                 // Update fields
      { new: true }                       // Return the updated document
    );

    if (!updatedArea) {
      return res.status(404).json({ message: 'Area not found.' });
    }

    return res.status(200).json({ message: 'Status updated successfully.', data: updatedArea });
  } catch (error) {
    console.error('Error updating status:', error);
    return res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
});


// Route to search for areas by partial name 
router.get('/search', async (req, res) => {
  const { query,clientId } = req.query; // Get the search query from query params

  if (!query || query.trim() === '') {
      areas = await Area.find({clientId});
      res.status(200).json({
          message: 'Areas found successfully!',
          areas,
      });
      return;
  }

  try {
      // Use $regex for partial matching in name or email
      const areas = await Area.find({
          $and: [
              {
                  $or: [
                      { name: { $regex: query, $options: 'i' } }, // Case-insensitive match for name
                      { type: { $regex: query, $options: 'i' } }, // Case-insensitive match for area type
                  ]
              },
              { clientId: clientId } // Match the specific clientId
          ]
      });
      if (areas.length === 0) {
          return res.status(404).json({ message: 'No areas found matching the search query' });
      }

      res.status(200).json({
          message: 'Areas found successfully!',
          areas,
      });
  } catch (err) {
      res.status(500).json({ error: 'Error searching for Areas', details: err.message });
  }
});


// Route to get all Areas
router.get('/', async (req, res) => {
  try {
     // console.log(req);
      const { clientId } = req.query;
      const areas = await Area.find({clientId}); // Fetch all areas
      res.status(200).json(areas);
  } catch (error) {
      res.status(500).json({ error: 'Error fetching areas', details: error.message });
  }
});



module.exports = router;
