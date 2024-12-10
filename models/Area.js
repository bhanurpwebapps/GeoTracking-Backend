const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['Classroom', 'Playground', 'Library', 'Clinic', 'Other'], required: true },
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client', 
    required: true
  },
  status:{type:String,enum:['Active','InActive']},
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Area', areaSchema);
