import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface TrackedObject {
  track_id: number;
  bbox: [number, number, number, number];
  confidence: number;
  class_id: number;
  class_name: string;
}

interface TrackingData {
  frame_id: number;
  frame: string; // base64
  tracked_objects: TrackedObject[];
  polygon_alerts: TrackedObject[];
  timestamp: number;
}

const RealTimeTracking: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('tracking_update', handleTrackingUpdate);
    newSocket.on('tracking_started', () => setIsTracking(true));
    newSocket.on('tracking_stopped', () => setIsTracking(false));

    return () => newSocket.close();
  }, []);

  const handleTrackingUpdate = (data: TrackingData) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = videoRef.current;

    // Atualizar imagem
    img.src = `data:image/jpeg;base64,${data.frame}`;
    img.onload = () => {
      // Ajustar canvas para o tamanho da imagem
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Desenhar imagem
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Desenhar polígono de atenção
      if (polygonPoints.length > 2) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0][0], polygonPoints[0][1]);
        polygonPoints.forEach(point => ctx.lineTo(point[0], point[1]));
        ctx.closePath();
        ctx.stroke();
      }

      // Desenhar bounding boxes
      data.tracked_objects.forEach(obj => {
        const [x1, y1, x2, y2] = obj.bbox;
        const isAlert = data.polygon_alerts.some(alert => alert.track_id === obj.track_id);
        
        ctx.strokeStyle = isAlert ? 'red' : 'green';
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Label
        ctx.fillStyle = isAlert ? 'red' : 'green';
        ctx.fillRect(x1, y1 - 25, 120, 25);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText(`${obj.class_name} #${obj.track_id}`, x1 + 5, y1 - 8);
      });
    };
  };

  const startTracking = () => {
    if (socket) {
      socket.emit('start_tracking', {
        video_source: 0, // webcam
        polygon_points: polygonPoints
      });
    }
  };

  const stopTracking = () => {
    if (socket) {
      socket.emit('stop_tracking');
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingPolygon || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPolygonPoints(prev => [...prev, [x, y]]);
  };

  const finishPolygon = () => {
    setIsDrawingPolygon(false);
    if (socket && polygonPoints.length > 2) {
      socket.emit('update_polygon', { polygon_points: polygonPoints });
    }
  };

  const clearPolygon = () => {
    setPolygonPoints([]);
    if (socket) {
      socket.emit('update_polygon', { polygon_points: [] });
    }
  };

  return (
    <div className="real-time-tracking">
      <div className="controls">
        <button onClick={startTracking} disabled={isTracking}>
          Iniciar Tracking
        </button>
        <button onClick={stopTracking} disabled={!isTracking}>
          Parar Tracking
        </button>
        <button 
          onClick={() => setIsDrawingPolygon(!isDrawingPolygon)}
          className={isDrawingPolygon ? 'active' : ''}
        >
          {isDrawingPolygon ? 'Desenhando...' : 'Desenhar Polígono'}
        </button>
        <button onClick={finishPolygon} disabled={polygonPoints.length < 3}>
          Finalizar Polígono
        </button>
        <button onClick={clearPolygon}>
          Limpar Polígono
        </button>
      </div>

      <div className="video-container">
        <img ref={videoRef} style={{ display: 'none' }} />
        <canvas 
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ 
            maxWidth: '100%', 
            height: 'auto',
            cursor: isDrawingPolygon ? 'crosshair' : 'default'
          }}
        />
      </div>

      <div className="status">
        Status: {isTracking ? 'Rastreando' : 'Parado'}
        {polygonPoints.length > 0 && (
          <span> | Polígono: {polygonPoints.length} pontos</span>
        )}
      </div>
    </div>
  );
};

export default RealTimeTracking;