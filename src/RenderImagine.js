import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './ImagineGallerry.css'; // Import CSS

const ImageGallery = () => {
  const [images, setImages] = useState([]);
  const [imageSrc, setImageSrc] = useState(null);
  const [coordinates, setCoordinates] = useState({ x1: 100, y1: 100, x2: 400, y2: 300 });
  const [imageName, setImageName] = useState('');
  const [file, setFile] = useState(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:5000');
    }

    axios.get('http://localhost:5000/api/images')
      .then(response => {
        setImages(response.data);
      })
      .catch(error => {
        console.error('Error fetching images:', error);
      });

    socketRef.current.on('newImage', (newImage) => {
      setImages((prevImages) => [...prevImages, newImage]);
    });

    return () => {
      socketRef.current.off('newImage');
    };
  }, []);

  const handleImageUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert('Please select a file');

    // Hiển thị ảnh ngay lập tức trước khi upload
    const imageUrl = URL.createObjectURL(file); // Tạo URL tạm thời cho ảnh đã chọn
    setImageSrc(imageUrl); // Cập nhật ảnh đã chọn để hiển thị ngay lập tức

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ABCDEFGH'); // Sử dụng upload preset "ABCDEFGH"
    try {
      // Upload file lên Cloudinary
      const res = await axios.post(
        'https://api.cloudinary.com/v1_1/dlxz97tpm/image/upload',
        formData
      );

      // Lưu URL vào backend
      const uploadedImageUrl = res.data.secure_url;
      await axios.post('http://localhost:5000/api/images', { title: imageName, imageUrl: uploadedImageUrl });

      alert('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image.');
    }
  };

  const drawBoundingBox = () => {
    if (canvasRef.current && imageSrc) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const image = new Image();
      image.src = imageSrc;

      image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        const { x1, y1, x2, y2 } = coordinates;
        ctx.beginPath();
        ctx.rect(x1, y1, x2 - x1, y2 - y1);
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'green';
        ctx.stroke();
      };
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const imageUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageName || 'output_image.png'; // Sử dụng tên người dùng nhập hoặc mặc định
    link.click();
  };

  return (
    <div className="container">
      <h1>Trang website</h1>
      
      <form className="upload-form" onSubmit={handleImageUpload}>
        <input
          type="text"
          placeholder="Nhập tên ảnh"
          value={imageName}
          onChange={(e) => setImageName(e.target.value)}
          required
        />
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          required
        />
        <button type="submit">Upload Image</button>
      </form>
      
      <div className="image-container">
        {/* Left side - Image display */}
        <div className="image-display">
          {imageSrc && <img src={imageSrc} alt="Uploaded" />} {/* Hiển thị ảnh ngay lập tức */}
        </div>

        {/* Center - Bounding box button */}
        <div className="action-buttons">
          {imageSrc && (
            <>
              <button className="btn" onClick={drawBoundingBox}>
                <span>▶️ Vẽ Bounding Box</span>
              </button>
              <button className="btn" onClick={downloadImage}>
                Tải ảnh đã vẽ
              </button>
            </>
          )}
        </div>

        {/* Right side - Canvas display */}
        <div className="canvas-display">
          {imageSrc && <canvas ref={canvasRef}></canvas>}
        </div>
      </div>
    </div>
  );
};

export default ImageGallery;
