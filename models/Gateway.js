const mongoose = require('mongoose');

const gatewaySchema = new mongoose.Schema({
  macAddress: { type: String, required: true },
  minRSSI: { type: Number, required: true },
  maxRSSI: { type: Number, required: true },
  connectedStatus: { type: Boolean, default: false },
  areaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Area', required: true },
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client', 
    required: true
  },
  status:{type:String,enum:['Active','InActive']},
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Gateway', gatewaySchema);
