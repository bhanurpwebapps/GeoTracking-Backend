const nodemailer = require('nodemailer');

const sendAlertToParents = (student) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: student.parentEmail,
    subject: 'Sensitive Zone Alert',
    text: `${student.name} has entered a sensitive area. Please check immediately.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error sending alert:', error);
    } else {
      console.log('Alert sent:', info.response);
    }
  });
};

const sendUnauthorizedAlert = (student) => {
  console.log(`${student.name} is in an unauthorized zone. Send alert.`);
  // Implement your own SMS or email alert logic here.
};

module.exports = { sendAlertToParents, sendUnauthorizedAlert };
