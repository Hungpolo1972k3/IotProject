const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const Image = require('./models/Image');
const cloudinary = require('cloudinary').v2;
const http = require('http'); // Tạo server cho Socket.IO
const { Server } = require('socket.io');
const os = require('os'); // Để hỗ trợ cluster

// Khởi tạo Express app và HTTP server
const app = express();
const server = http.createServer(app);

// Cấu hình Socket.IO với các tối ưu
const io = new Server(server, {
  cors: {
    origin: '*', // Cho phép tất cả domain kết nối
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e6, // Giới hạn kích thước gói tin (1MB)
});

app.use(cors());
app.use(bodyParser.json());

// Kết nối Cloudinary
cloudinary.config({
  cloud_name: 'dlxz97tpm',
  api_key: '522334272865792',
  api_secret: 'SIY6ype2zhwjGOAq3IbhNEpTwmc',
});

// Kết nối MongoDB
mongoose
  .connect('mongodb+srv://NguyenThoHung:gv9pc8nZXxIkdUSF@cluster0.0g4h5.mongodb.net/cloudinary-demo', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('MongoDB connection error:', error));

// Biến lưu số lượng kết nối theo IP
const MAX_CONNECTIONS_PER_IP = 5;
const connectionCounts = {};

// Xử lý kết nối client qua Socket.IO
io.on('connection', (socket) => {
  const ip = socket.handshake.address;
  
  // Kiểm tra và giới hạn kết nối theo IP
  if (!connectionCounts[ip]) connectionCounts[ip] = 0;
  connectionCounts[ip]++;

  if (connectionCounts[ip] > MAX_CONNECTIONS_PER_IP) {
    console.log(`Too many connections from IP: ${ip}`);
    socket.disconnect(true); // Ngắt kết nối nếu vượt quá giới hạn
    return;
  }

  console.log(`Client connected: ${socket.id}`);

  // Xử lý ngắt kết nối
  socket.on('disconnect', () => {
    connectionCounts[ip]--;
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Lấy danh sách ảnh
app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find();
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API thêm ảnh mới
app.post('/api/images', async (req, res) => {
  const { title, imageUrl } = req.body;

  try {
    // Log chi tiết để theo dõi quá trình upload
    console.log('Uploading image to Cloudinary...');
    
    // Upload ảnh lên Cloudinary
    const uploadedImage = await cloudinary.uploader.upload(imageUrl);
    console.log('Image uploaded successfully:', uploadedImage);

    // Lưu URL Cloudinary vào MongoDB
    const newImage = new Image({ title, imageUrl: uploadedImage.secure_url });
    await newImage.save();

    // Phát sự kiện ảnh mới cho client qua Socket.IO
    io.emit('newImage', newImage);

    res.status(201).json(newImage);
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Chạy server với môi trường cluster nếu có nhiều CPU
if (os.cpus().length > 1) {
  const cluster = require('cluster');

  if (cluster.isMaster) {
    console.log(`Master process is running with PID: ${process.pid}`);

    // Fork các worker process
    os.cpus().forEach(() => cluster.fork());

    // Restart worker khi nó bị lỗi
    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died. Restarting...`);
      cluster.fork();
    });
  } else {
    server.listen(5000, () => {
      console.log(`Worker process ${process.pid} is running on http://localhost:5000`);
    });
  }
} else {
  // Chạy trên máy đơn CPU
  server.listen(5000, () => {
    console.log('Server is running on http://localhost:5000');
  });
}
