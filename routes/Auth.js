const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const client = require('../models/client');
const router = express.Router();

// // Sign-up route
// router.post('/signup', async (req, res) => {
//   try {
//     const { username, password, name, location, contactEmail, mobile, role } = req.body;

//     // Check if username already exists
//     const existingUser = await School.findOne({ username });
//     if (existingUser) {
//       return res.status(400).json({ message: 'Username already exists!' });
//     }

//     // Create new user
//     const newUser = new School({
//       username,
//       password,
//       name,
//       location,
//       contactEmail,
//       mobile,
//       role,
//     });

//     await newUser.save();
//     res.status(201).json({ message: 'User signed up successfully!' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Error signing up user.' });
//   }
// });

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Find user by username
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(isMatch)
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role, userType: user.userType },
      process.env.JWT_SECRET || 'your_jwt_secret', 
      { expiresIn: '1d' } // Token expiration time
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        userType: user.userType,
        clientId:user.clientId
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Password change route
router.post('/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  try {
    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'User not found!' });
    }

    // Check if old password matches
    const isPasswordCorrect = await user.comparePassword(oldPassword);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    // Update password
    user.password = newPassword;
    user.isTempPassword = false;  // Set the flag to false as the password is no longer temporary
    user.passwordSetAt = Date.now();  // Update the timestamp to reflect password change

    await user.save();
    res.status(200).json({ message: 'Password changed successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error changing password.' });
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


module.exports = { router, authMiddleware };
