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
  // email: String,
  date: String,
  division: String,
  department: String,
  session: String,
  barcode: String,
}, { timestamps: true });

const Booking = mongoose.model('Booking', BookingSchema);


app.put('/api/update-booking-date', async (req, res) => {
  const { employeeId, newDate, newSession } = req.body;

  if (!employeeId || !newDate || !newSession) {
    return res.status(400).json({ message: 'Employee ID, tanggal, dan sesi harus wajib diisi!' });
  }

  try {
    const booking = await Booking.findOne({ employeeId });

    if (!booking) {
      return res.status(404).json({ message: 'Data booking tidak ditemukan!' });
    }
    booking.session = newSession;
    booking.date = newDate;
    await booking.save();

    res.json({ message: 'Tanggal booking berhasil diperbarui!', updatedBooking: booking });
  } catch (err) {
    console.error("🔥 Error saat mengupdate booking:", err);
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui booking.' });
  }
});


app.get('/api/check-booking', async (req, res) => {
  const { employeeId } = req.query;

  const existingBooking = await Booking.findOne({ employeeId });

  if (existingBooking) {
      return res.status(400).json({ message: 'Anda sudah pernah melakukan booking!' });
  }

  res.json(existingBooking);
});

app.get('/api/check-status', async (req, res) => {
  const { employeeId } = req.query;

  const dataBooking = await Booking.findOne({ employeeId });

  if (!dataBooking) {
      return res.status(400).json({ message: 'Data booking tidak ditemukan' });
  }

  res.json(dataBooking);
});

app.get('/api/slots', async (req, res) => {
    const { date, department } = req.query;
    const sessions = ['08:30 - 10:00', '10:00 - 11:30', '13:00 - 14:30', '14:30 - 16:00'];
  
    let result = {};
    for (let session of sessions) {
      const count = await Booking.countDocuments({ date, session });
      const deptCount = await Booking.countDocuments({ date, session, department });
      // result[session] = 25 - count;
      result[session] = {
        available: count < 25 && deptCount < 3, // Maksimum 3 slot per departemen
        remaining: 25 - count,
        deptRemaining: 3 - deptCount
      };
    }
    
    res.json(result);
});
  

app.post('/api/book', async (req, res) => {
    const { employeeId, name, division, department, date, session } = req.body;
  
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
    const booking = new Booking({ employeeId, name, division, department, date, session, barcode: employeeId });
    await booking.save();
  
    // Kirim Email
    // const transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   host: "smtp.gmail.com",
    //   secure: false,
    //   port: 587,
    //   auth: { 
    //     user: process.env.EMAIL_USER, 
    //     pass: process.env.EMAIL_PASS 
    //     },
    // });
  
    // await transporter.sendMail({
    //   from: process.env.EMAIL_USER,
    //   to: email,
    //   subject: 'Konfirmasi Booking TMMIN Quality Exhibition 2025',
    //   html: `<p>Halo ${name},</p><p>Booking Anda untuk sesi ${session} pada tanggal ${date} berhasil.</p><p>Berikut QR Code Anda Terlampir, Bawalah QRCode ini pada saat exhibition dan tunjukkan kepada panitia!</p>`,
    //   attachments: [{ filename: 'QRCode_Booking.png', content: barcodeBuffer }],
    // });
  
    res.json({ message: 'Booking berhasil' });
  });
  

// Jalankan server
app.listen(5000, () => console.log('Server running on port 5000'));
