const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contactNumber: { type: String },
  address:{type:String,required:true},
  subscriptionPlan: { type: String, enum: ['Basic', 'Premium', 'Enterprise'] },
  status:{type:String,enum:['Active','InActive']},
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Client', ClientSchema);

//Client Name, Email,Contact, address status