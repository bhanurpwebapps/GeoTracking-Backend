const express = require('express');
const School = require('../models/School');
const { authMiddleware } = require('./Auth'); // Import the authentication middleware
const router = express.Router();

// 1. Create or Update a School Configuration (Upsert)
router.post('/upsertSchoolConfiguration', async (req, res) => {
  try {
    const { clientId } = req.body;

    // Validate input
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    // Perform upsert operation
    const school = await School.findOneAndUpdate(
      { clientId },
      { $set: req.body },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: 'School configuration upserted successfully', data: school });
  } catch (error) {
    console.error('Error upserting school configuration:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 2. Get School Configuration by Client ID
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Find school configuration by clientId
    const school = await School.findOne({ clientId });

    if (!school) {
      return res.status(404).json({ message: 'School configuration not found' });
    }

    res.status(200).json({ message: 'School configuration fetched successfully', data: school });
  } catch (error) {
    console.error('Error fetching school configuration:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 3. Delete School Configuration by Client ID
router.delete('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Delete the school configuration
    const result = await School.findOneAndDelete({ clientId });

    if (!result) {
      return res.status(404).json({ message: 'School configuration not found' });
    }

    res.status(200).json({ message: 'School configuration deleted successfully', data: result });
  } catch (error) {
    console.error('Error deleting school configuration:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
