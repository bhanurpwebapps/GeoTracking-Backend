const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
  label: { type: String, required: true },
  img: { type: String, required: true },
  link: { type: String, required: true },
  userType: { type: String, required: false }, // Optional
});

module.exports = mongoose.model('MenuItem', MenuItemSchema);
