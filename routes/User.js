
const express = require('express');
const User = require('../models/User'); //Assuming the user schema is in `models/user.model.js`
const router = express.Router();

router.post('/create', async (req, res) => {
    const { name, username, email, contactNumber, role, clientId, status } = req.body;

    try {
        // Check if the user exists by email
        let user = await User.findOne({ email });
    
        if (user) {
          // If user exists, update their information
          user.name = name || user.name;
          user.username = username || user.username;
          user.contactNumber = contactNumber || user.contactNumber;
          user.role = role || user.role;
          //user.userType = userType || user.userType;
          user.clientId = clientId || user.clientId;
          user.status = status || user.status;
    
        //   // Update password only if provided in the request
        //   if (password) {
        //     const salt = await bcrypt.genSalt(10);
        //     user.password = await bcrypt.hash(password, salt);
        //   }
    
          const updatedUser = await user.save();
          return res.status(200).json({
            message: 'User updated successfully!',
            user: updatedUser,
          });
        } else {
          // If user doesn't exist, create a new one
          const newUser = new User({
            name,
            username,
            email,
            contactNumber,
            password: username,
            role,
            userType: 'ClientUser',
            clientId,
            status,
          });
    
          const savedUser = await newUser.save();
          return res.status(201).json({
            message: 'User created successfully!',
            user: savedUser,
          });
        }
      } catch (err) {
        res.status(500).json({ error: 'Error creating or updating user', details: err.message });
      }
});


router.post('/update-status', async (req, res) => {
    const { username, status } = req.body;

    try {
        // Step 1: Find the User by Username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Step 2: Update the user's status
        user.status = status;
        await user.save();        

        res.status(200).json({
            message: 'User status updated successfully!',
            user
        });
    } catch (err) {
        res.status(500).json({ error: 'Error updating status', details: err.message });
    }
});


// Route to search for users by partial name or email
router.get('/search', async (req, res) => {
    const { query,clientId } = req.query; // Get the search query from query params

    if (!query || query.trim() === '') {
        users = await User.find({clientId});
        res.status(200).json({
            message: 'Users found successfully!',
            users,
        });
        return;
    }

    try {
        // Use $regex for partial matching in name or email
        const users = await User.find({
            $and: [
                {
                    $or: [
                        { name: { $regex: query, $options: 'i' } }, // Case-insensitive match for name
                        { username: { $regex: query, $options: 'i' } }, // Case-insensitive match for username
                        { email: { $regex: query, $options: 'i' } }, // Case-insensitive match for email
                        { contactNumber: { $regex: query, $options: 'i' } } // Case-insensitive match for contactNumber
                    ]
                },
                { clientId: clientId } // Match the specific clientId
            ]
        });
        if (users.length === 0) {
            return res.status(404).json({ message: 'No users found matching the search query' });
        }

        res.status(200).json({
            message: 'Users found successfully!',
            users,
        });
    } catch (err) {
        res.status(500).json({ error: 'Error searching for users', details: err.message });
    }
});


// Route to get all Users
router.get('/', async (req, res) => {
    try {
       // console.log(req);
        const { clientId } = req.query;
        const users = await User.find({clientId}); // Fetch all users
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users', details: error.message });
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