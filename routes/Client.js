
const express = require('express');
const Client = require('../models/client');
const User = require('../models/User'); //Assuming the user schema is in `models/user.model.js`
const router = express.Router();

router.post('/create', async (req, res) => {
    const { name, email, contactNumber, address, subscriptionPlan, status } = req.body;
  
    try {
      // Step 1: Check if the client already exists
      let client = await Client.findOne({ name });
  
      if (client) {
        // Update existing client
        client.name = name;
        client.contactNumber = contactNumber;
        client.address = address;
        client.subscriptionPlan = subscriptionPlan;
        client.status = status;
  
        // Save updated client details
        await client.save();
      } else {
        // Create a new client if not found
        client = new Client({
          name,
          email,
          contactNumber,
          address,
          subscriptionPlan,
          status,
        });
  
        await client.save();
      }
  
      // Step 2: Check if admin user exists for the client
      let adminUser = await User.findOne({ clientId: client._id, name: `${name} Admin`});
  
      if (adminUser) {
        // If admin user exists, update the details (you may update the email, etc.)
        adminUser.name = `${name} Admin`; // Update name if required
        adminUser.username = `${name.toLowerCase()}-admin`; // Update username
        adminUser.password = 'password123'; // For security reasons, you should hash this password.
  
        // Save updated admin user
        await adminUser.save();
      } else {
        // Create a new admin user for the client if not found
        adminUser = new User({
          name: `${name} Admin`,
          username: email,//`${name.toLowerCase()}-admin`,
          email, // Use the client's email,
          contactNumber,
          password: 'admin', // Default password
          role: 'Admin',
          userType: 'ClientUser',
          clientId: client._id, // Reference to the client
        });
  
        await adminUser.save();
      }
  
      res.status(200).json({
        message: 'Client and admin user processed successfully!',
        client,
        adminUser,
      });
    } catch (err) {
      res.status(500).json({ error: 'Error processing client or admin user', details: err.message });
    }
  });


  router.post('/update-status', async (req, res) => {
    const { name, status } = req.body;
  
    try {
      // Step 1: Find the client by email
      const client = await Client.findOne({ name });
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
  
      // Step 2: Update the client's status
      client.status = status;
      await client.save();
  
      // Step 3: Find the admin user for the client
      const adminUser = await User.findOne({ clientId: client._id, role: 'Admin' });
      if (adminUser) {
        // Update the admin user's status (if needed)
        adminUser.status = status; // You can also update other fields if needed
        await adminUser.save();
      }
  
      res.status(200).json({
        message: 'Client and admin user status updated successfully!',
        client,
        adminUser: adminUser || null,
      });
    } catch (err) {
      res.status(500).json({ error: 'Error updating status', details: err.message });
    }
  });
  

 // Route to search for clients by partial name or email
router.get('/search', async (req, res) => {
    const { query } = req.query; // Get the search query from query params
  
    if (!query || query.trim() === '') {
        clients = await Client.find({});
        res.status(200).json({
            message: 'Clients found successfully!',
            clients,
          });
       return;
    }
  
    try {
      // Use $regex for partial matching in name or email
      const clients = await Client.find({
        $or: [
          { name: { $regex: query, $options: 'i' } }, // Case-insensitive match for name
          { email: { $regex: query, $options: 'i' } }, // Case-insensitive match for email
          { contactNumber: { $regex: query, $options: 'i' } }
        ],
      });
      if (clients.length === 0) {
        return res.status(404).json({ message: 'No clients found matching the search query' });
      }
  
      res.status(200).json({
        message: 'Clients found successfully!',
        clients,
      });
    } catch (err) {
      res.status(500).json({ error: 'Error searching for clients', details: err.message });
    }
  });
  

// // Create Client and Admin User
// // Create Area
// router.post('/create', async (req, res) => {
//   const { name, email, contactNumber, address, subscriptionPlan, status } = req.body;

//   try {
//     // Step 1: Create Client
//     const newClient = new Client({
//       name,
//       email,
//       contactNumber,
//       address,
//       subscriptionPlan,
//       status,
//     });

//     const savedClient = await newClient.save();

//     // Step 2: Create Admin User for Client
//     const adminUser = new User({
//       name: `${name} Admin`, // Default admin name
//       username: `${name.toLowerCase()}-admin`, // Default admin username
//       email: email, // Using client's email
//       password: 'password123', // Default password, ensure this is hashed in the User model
//       role: 'Admin',
//       userType: 'ClientUser',
//       clientId: savedClient._id, // Reference to the newly created client
//     });

//     const savedAdminUser = await adminUser.save();

//     res.status(201).json({
//       message: 'Client and admin user created successfully!',
//       client: savedClient,
//       adminUser: savedAdminUser,
//     });
//   } catch (err) {
//     res.status(500).json({ error: 'Error creating client or admin user', details: err.message });
//   }
// });

// Route to get all clients
router.get('/', async (req, res) => {
    try {
      const clients = await Client.find(); // Fetch all clients
      res.status(200).json(clients);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching clients', details: error.message });
    }
  });


// Middleware to protect routes
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access denied' });
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(400).json({ message: 'Invalid token' });
    }
  };


module.exports = router;