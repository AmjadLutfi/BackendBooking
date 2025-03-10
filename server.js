const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const bwipjs = require('bwip-js');
const cors = require('cors');
const dotenv = require('dotenv');
const QRCode = require('qrcode')

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// Koneksi ke MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

const BookingSchema = new mongoose.Schema({
  employeeId: String,
  name: String,
  email: String,
  date: String,
  session: String,
  barcode: String,
}, { timestamps: true });

const Booking = mongoose.model('Booking', BookingSchema);

// **2. Endpoint untuk Cek Slot**
app.get('/api/slots', async (req, res) => {
    const { date } = req.query;
    const sessions = ['08:30 - 10:00', '10:00 - 11:30', '13:00 - 14:30', '14:30 - 16:00'];
  
    let result = {};
    for (let session of sessions) {
      const count = await Booking.countDocuments({ date, session });
      result[session] = 25 - count;
    }
    
    res.json(result);
});
  

// **3. Endpoint untuk Booking**
app.post('/api/book', async (req, res) => {
    const { employeeId, name, email, date, session } = req.body;
  
    // Cek kapasitas sesi
    const count = await Booking.countDocuments({ date, session });
    if (count >= 25) return res.status(400).json({ message: 'Sesi penuh' });
  
    // Generate barcode
    const barcodeBuffer = await new Promise((resolve, reject) => {
      bwipjs.toBuffer({ bcid: 'qrcode', text: employeeId }, (err, png) => {
        if (err) reject(err);
        else resolve(png);
      });
    });

    const qrCodeData = await QRCode.toDataURL(employeeId);
  
    // Simpan booking
    const booking = new Booking({ employeeId, name, email, date, session, barcode: employeeId });
    await booking.save();
  
    // Kirim Email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: "smtp.gmail.com",
      secure: false,
      port: 587,
      auth: { 
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
        },
    });
  
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Konfirmasi Booking',
      html: `<p>Halo ${name},</p><p>Booking Anda untuk sesi ${session} pada ${date} berhasil.</p><p>QRCode Anda:</p>`,
      attachments: [{ filename: 'barcode.png', content: barcodeBuffer }],
    });
  
    res.json({ message: 'Booking berhasil' });
  });
  

// Jalankan server
app.listen(5000, () => console.log('Server running on port 5000'));
