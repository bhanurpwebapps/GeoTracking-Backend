const express = require('express');
const Gateway = require('../models/menu');
const router = express.Router();

// Seed Menu Items
router.post('/getMenuItems', async (req, res) => {

    try {
        const { userType } = req.query; // Optionally filter by userType
        const query = userType ? { userType } : {};
        const menuItems = await MenuItem.find(query);
        res.json(menuItems);
      } catch (err) {
        res.status(500).json({ error: 'Failed to fetch menu items' });
      }

})

// Seed Menu Items
router.post('/seedMenuItems ', async (req, res) => {
    const menuItems = [
   
        // Product Admin Links
        {
            label: 'Dashboard Admin',
            img:"assets/images/dashboard-icon.svg",
            link: 'dashboard-productadmin',
            userType:'AppProvider'
        },
    
        {
            label: 'Clients',
            img:"assets/images//students-icon.svg",
            link: 'clients',
            userType:'AppProvider'
        },
        // Product Admin Links End
    
    
       // Clients Admin Links
            {
                label: 'Dashboard Client',
                img:"assets/images/dashboard-icon.svg",
                link: 'dashboard-client',
                userType:'Client'
            },
    
            {
                label: 'Users',
                img:"assets/images/users-icon.svg",
                link: 'users',
                userType:'Client'
            },
    
            {
                label: 'Areas',
                img:"assets/images/areas-icon.svg",
                link: 'areas',
                userType:'Client'
            },
    
            {
                label: 'Gateways',
                img:"assets/images/gateway-icon.svg",
                link: 'gateways',
                userType:'Client'
            },
    
            {
                label: 'Badges',
                img:"assets/images/badges-icon.svg",
                link: 'badges',
                userType:'Client'
            },
    
            {
                label: 'Students',
                img:"assets/images/students-icon.svg",
                link: 'students',
                userType:'Client'
            },
    
            {
                label: 'Attendance',
                img:"assets/images/attendance-icon.svg",
                link: 'attendance',
                userType:'Client'
            },
    
     
    ];
    
      try {
        await MenuItem.insertMany(menuItems);
        res.status(201).json({ message: 'Menu items seeded successfully!' });
      } catch (err) {
        res.status(500).json({ error: 'Failed to seed menu items' });
      }
});

module.exports = router;
