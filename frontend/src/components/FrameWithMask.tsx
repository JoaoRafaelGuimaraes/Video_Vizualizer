import React, { useEffect, useRef, useState } from 'react';
import { videoAPI } from '../services/api';
import './FrameWithMask.css';

interface Detection {
  bbox: [number, number, number, number];
  class_id: number;
  class_name: string;
}

interface FrameWithMaskProps {
  videoName: string;
  frameName: string;
  imageUrl: string;
  className?: string;
}

const FrameWithMask: React.FC<FrameWithMaskProps> = ({
  videoName,
  frameName,
  imageUrl,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detections, setDetections] = useState<Detection[]>([]);

  useEffect(() => {
    // Reset ao mudar props
    setStatus('loading');
    setDetections([]);

    // 1. Carregar máscara (opcional)
    videoAPI.getMask(videoName, frameName)
      .then((data) => {
        setDetections(data.result?.detections || []);
      })
      .catch(() => {
        // Sem máscara, tudo bem
        setDetections([]);
      });

    // 2. Criar e carregar imagem
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      imgRef.current = img;
      setStatus('ready');
    };

    img.onerror = () => {
      setStatus('error');
    };

    img.src = imageUrl;

    // Cleanup
    return () => {
      imgRef.current = null;
    };
  }, [videoName, frameName, imageUrl]);

  // Desenhar no canvas quando status='ready' e detections mudar
  useEffect(() => {
    if (status !== 'ready') return;
    
    const canvas = canvasRef.current;
    const img = imgRef.current;
    
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar canvas
    canvas.width = img.width;
    canvas.height = img.height;

    // Desenhar imagem
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Desenhar detecções
    detections.forEach((det, idx) => {
      const [x1, y1, x2, y2] = det.bbox;

      // Converter para pixels
      const px1 = x1 * img.width;
      const py1 = y1 * img.height;
      const px2 = x2 * img.width;
      const py2 = y2 * img.height;
      const w = px2 - px1;
      const h = py2 - py1;

      // Cor única por detecção
      const hue = (idx * 137) % 360;
      const fillColor = `hsla(${hue}, 70%, 50%, 0.3)`;
      const strokeColor = `hsl(${hue}, 70%, 50%)`;

      // Desenhar retângulo
      ctx.fillStyle = fillColor;
      ctx.fillRect(px1, py1, w, h);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(px1, py1, w, h);

      // Desenhar label
      const label = det.class_name || `Class ${det.class_id}`;
      ctx.font = 'bold 14px Arial';
      const textWidth = ctx.measureText(label).width;
      
      // Fundo do label
      ctx.fillStyle = strokeColor;
      ctx.fillRect(px1, py1 - 20, textWidth + 8, 20);
      
      // Texto do label
      ctx.fillStyle = 'white';
      ctx.fillText(label, px1 + 4, py1 - 5);
    });

  }, [status, detections]);

  if (status === 'loading') {
    return (
      <div 
        className={className}
        style={{ 
          width: '150px', 
          height: '100px', 
          background: '#e0e0e0',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '11px'
        }}
      >
        ...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div 
        className={className}
        style={{ 
          width: '150px', 
          height: '100px', 
          background: '#ffcccc',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#cc0000',
          fontSize: '11px',
          textAlign: 'center',
          padding: '8px'
        }}
      >
        Erro
      </div>
    );
  }

  return <canvas ref={canvasRef} className={className} />;
};

export default FrameWithMask;
