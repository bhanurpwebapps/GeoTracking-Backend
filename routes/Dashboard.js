const express = require('express');
const mongoose = require('mongoose');
const Gateway = require('../models/Gateway');
const Area = require('../models/Area');
const Student = require('../models/Student');
const router = express.Router();

router.get('/dashboarddata', async (req, res) => {
    try {
        const { clientId } = req.query; // Optional filtering by clientId
    
        // Match clientId if provided
        const clientFilter = clientId ? { clientId: new mongoose.Types.ObjectId(clientId) } : {};
    
        // Step 1: Create separate queries
        const gatewaysCountQuery = Gateway.countDocuments(clientFilter); // Count Gateways
        const areasCountQuery = Area.countDocuments(clientFilter);       // Count Areas
        const studentsCountQuery = Student.countDocuments(clientFilter); // Count Students
    
        // Step 2: Execute queries in parallel
        const [totalGateways, totalAreas, totalStudents] = await Promise.all([
          gatewaysCountQuery,
          areasCountQuery,
          studentsCountQuery,
        ]);
    
        // Step 3: Format and return response
        res.status(200).json({
          totalGateways,
          totalAreas,
          totalStudents,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error.message);
        res.status(500).json({
          error: "Error fetching dashboard data",
          details: error.message,
        });
      }
  });
  

  module.exports = router;