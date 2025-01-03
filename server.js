const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const { router: authRoutes} = require('./routes/Auth');
const Client = require('./models/Client');
const schoolRoutes = require('./routes/School');
const areaRoutes = require('./routes/Area');
const gatewayRoutes = require('./routes/Gateway');
const studentRoutes = require('./routes/Student');
const clientRoutes = require('./routes/Client');
const userRoutes = require('./routes/User');
const dashboardRoutes = require('./routes/Dashboard');
const appProviderdashboardRoutes = require('./routes/AppProviderDashBoard');
const AttendanceRoutes = require('./routes/Attendance');
//const Client = require('./models/Client');
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('Error connecting to MongoDB:', err));

  mongoose.connection.once('open', async () => {
    console.log('Connected to MongoDB.');
  
    // Default AppProvider details
    const defaultUser = {
      username: 'defaultAdmin',
      password: 'securePassword', // Replace with a strong password
    };
  
    try {
      // Check if the user already exists
      const existingUser = await User.findOne({ username: defaultUser.username });
      if (existingUser) {
        console.log('Default user already exists.');
      } else {
        // Hash the password
        //const salt = await bcrypt.genSalt(10);
        //const hashedPassword = await bcrypt.hash(defaultUser.password, salt);
  
        // Create the default user
        const newUser = new User({
          email:'test@gmail.com',
          name:'test',
          username: defaultUser.username,
          password: defaultUser.password,
          role: 'AppProvider',
          userType: 'AppProvider',
        });
  
        await newUser.save();
        console.log('Default user created successfully.');
      }
    } catch (err) {
      console.error('Error creating default user:', err);
    } finally {
      //mongoose.connection.close(); // Close connection after script runs
    }
  });



// Authentication Routes
app.use('/api/auth', authRoutes);

// School Routes
//app.use('/api/schools', schoolRoutes);

// Create Client and Admin User
app.use('/api/client', clientRoutes);

// Create Client and Admin User
app.use('/api/user', userRoutes);

// Area Routes
app.use('/api/areas', areaRoutes);

// Gateway Routes
app.use('/api/gateways', gatewayRoutes);

// Student Routes
app.use('/api/students', studentRoutes);

//dashboard
app.use('/api/dashboard',dashboardRoutes);

//app provider dashboard
app.use('/api/productadmindashboard',appProviderdashboardRoutes);

app.use('/api/schools',schoolRoutes);

app.use('/api/Attendance',AttendanceRoutes);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Socket.io Setup
const io = require('socket.io')(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
});


// Attach to global
global.io = io;



const mqtt = require('./utils/mqtt');