import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import './App.css';
import face from './faceData';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

function App() {
  const videoHeight = 480;
  const videoWidth = 640;
  const [initializing, setInitializing] = useState(false);
  const videoRef = useRef();
  const canvasRef = useRef();
  const faceMatcherRef = useRef();
  const detectionsRef = useRef([]);
  const detectionsNameRef = useRef();
  const detectionsLimitRef = useRef(0);

  const loadTrainingData = async () => {
    const label = face.name;
    const faceDescriptors = [];
    const descriptors = [];
  
    // Sử dụng Promise.all để chờ cho tất cả các tác vụ tải hình ảnh và nhận dạng kết thúc
    await Promise.all(face.images.map(async (imageData) => {
      try {
        const image = await faceapi.fetchImage(imageData.src);
        const detection = await faceapi.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor();
        descriptors.push(detection.descriptor);
      } catch (error) {
        console.error(`Error loading or processing image: ${imageData.src}`);
      }
    }));
  
    faceDescriptors.push(new faceapi.LabeledFaceDescriptors(label, descriptors));

    Toastify({
      text: "Đã training data xong...",
      duration: 2000,
      close: true,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
    }).showToast();

    return faceDescriptors;
  };

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = process.env.PUBLIC_URL + '/models';
      setInitializing(true);
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]).then(startVideo);

      Toastify({
        text: "Đã load xong models...",
        duration: 2000,
        close: true,
        gravity: "top",
        position: "right",
        stopOnFocus: true,
      }).showToast();

      const trainingData = await loadTrainingData()
      faceMatcherRef.current = new faceapi.FaceMatcher(trainingData, 0.7)

	    console.log(faceMatcherRef.current)
    }
    loadModels();
  }, [])

  const startVideo = () => {
    navigator.getUserMedia({
      video: {}
    }, stream => videoRef.current.srcObject = stream, 
    (err) => {
      console.error(`The following error occurred: ${err.name}`);
    })
  }

  const handleVideoOnplay = () => {
    setInterval( async () => {
      if (initializing) {
        setInitializing(false);
      }

      canvasRef.current.innerHTML = faceapi.createCanvasFromMedia(videoRef.current);
      const displaySize = {
        width: videoWidth,
        height: videoHeight
      }

      faceapi.matchDimensions(canvasRef.current, displaySize);

      const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions().withFaceDescriptors();
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      detectionsRef.current = detections;

      canvasRef.current.getContext('2d').clearRect(0, 0, videoWidth, videoHeight);
      for (const detection of resizedDetections) {
        detectionsNameRef.current = faceMatcherRef.current.findBestMatch(detection.descriptor).label;
        const drawBox = new faceapi.draw.DrawBox(detection.detection.box, {
          label: detectionsNameRef.current
        })
        drawBox.draw(canvasRef.current)
      }
      // faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
      // faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);

      console.log('detectionsRef.current', detectionsRef.current)
      if (detectionsRef.current.length > 0) {
        Toastify({
          text: detectionsNameRef.current,
          duration: 2000,
          close: true,
          gravity: "top",
          position: "right",
          stopOnFocus: true,
        }).showToast();
        if (detectionsNameRef.current !== face.name) {
          detectionsLimitRef.current++;
          console.log('detectionsLimitRef.current', detectionsLimitRef.current)
        } else {
          detectionsLimitRef.current = 0;
        }
      } else {
        Toastify({
          text: "Không phát hiện khuôn mặt...",
          duration: 2000,
          close: true,
          gravity: "top",
          position: "right",
          stopOnFocus: true,
        }).showToast();
        detectionsLimitRef.current++;
        console.log('detectionsLimitRef.current', detectionsLimitRef.current)
      }

      if (detectionsLimitRef.current > 10) {
        Toastify({
          text: "Bạn đã vượt quá số lần vắng mặt, mời bạn ra khỏi lớp",
          duration: 2000,
          close: true,
          gravity: "top",
          position: "right",
          stopOnFocus: true,
        }).showToast();
      }
    }, 5000)
  }

  return (
    <div className="App">
      <span style={{ fontSize: '24px', color: '#fff' }}>{initializing ? 'Initializing' : 'Ready'}</span>
      <div className='container'>
        <video className='video' ref={videoRef} height={videoHeight} width={videoWidth} onPlay={handleVideoOnplay} autoPlay muted />
        <canvas className='canvas' ref={canvasRef} />
      </div>
    </div>
  );
}

export default App;