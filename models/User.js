const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Define the User Schema (as you already have it)
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contactNumber: { type: String },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['AppProvider' ,'Admin', 'Teacher', 'Parent'], 
    required: true 
  },
  userType: { 
    type: String, 
    enum: ['AppProvider', 'ClientUser'], 
    required: true 
  },
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client', 
    required: function() { return this.userType === 'ClientUser'; } 
  },
  status:{type:String,enum:['Active','InActive']},
  createdAt: { type: Date, default: Date.now },
});

// Password Hashing Middleware
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare Passwords
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
