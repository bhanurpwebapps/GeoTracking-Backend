const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const studentSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    studentRegistrationNo: { 
      type: String, 
      required: true,
      minlength: [6, 'Student registration number must be at least 6 characters long'], // Minimum length validation
      maxlength: [20, 'Student registration number cannot exceed more than 20 characters'], // Maximum length validation
      match: [/^[a-zA-Z0-9]*$/, 'Student registration number must be alphanumeric'] // Alphanumeric validation
    },
    rollNo: { type: Number }, // Auto-increment rollNo
    classRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Area' },
    address: { type: String, required: true },
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true },
    },
    bleDeviceId: { type: String, required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },

    authorizedAreas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Area' }],
    status:{type:String,enum:['Active','InActive']},
  },
  { timestamps: true }
);

// Add auto-increment plugin for rollNo
studentSchema.plugin(AutoIncrement, { inc_field: 'rollNo', start_seq: 1 });

module.exports = mongoose.model('Student', studentSchema);
