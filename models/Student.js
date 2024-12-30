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
    // Add DateOfBirth field
    dateOfBirth: { type: Date, required: true },
    age: { type: Number, required: false }, // Added age field
  },
  { timestamps: true }
);

// Add auto-increment plugin for rollNo
studentSchema.plugin(AutoIncrement, { inc_field: 'rollNo', start_seq: 1 });

studentSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('dateOfBirth')) {
    const now = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDifference = now.getMonth() - birthDate.getMonth();

    // Adjust age if birthday hasn't occurred yet this year
    if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }

    // Set the calculated age to the age field
    this.age = age;
  }
  next(); // Move to the next middleware or save operation
});


// // Virtual for Age calculation
// studentSchema.virtual('age').get(function() {
//   const now = new Date();
//   const birthDate = new Date(this.dateOfBirth);
//   let age = now.getFullYear() - birthDate.getFullYear();
//   const monthDifference = now.getMonth() - birthDate.getMonth();

//   // Adjust age if birthday hasn't occurred yet this year
//   if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < birthDate.getDate())) {
//     age--;
//   }
//   return age;
// });

// Ensure the virtual is included when calling .toJSON() or .toObject()
studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);
