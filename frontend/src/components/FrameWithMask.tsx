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
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar a máscara
  useEffect(() => {
    const loadMask = async () => {
      try {
        const maskData = await videoAPI.getMask(videoName, frameName);
        setDetections(maskData.result?.detections || []);
      } catch (error) {
        // Se não houver máscara, apenas não exibe nada
        console.debug(`Sem máscara para ${videoName}/${frameName}`);
        setDetections([]);
      }
    };
    loadMask();
  }, [videoName, frameName]);

  // Desenhar a imagem e máscaras no canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      // Configurar tamanho do canvas
      canvas.width = img.width;
      canvas.height = img.height;

      // Desenhar imagem
      ctx.drawImage(img, 0, 0);

      // Desenhar bounding boxes
      if (detections.length > 0) {
        detections.forEach((det, idx) => {
          const [x1, y1, x2, y2] = det.bbox;
          
          // Converter coordenadas normalizadas para pixels
          const px1 = x1 * img.width;
          const py1 = y1 * img.height;
          const px2 = x2 * img.width;
          const py2 = y2 * img.height;
          const width = px2 - px1;
          const height = py2 - py1;

          // Cor baseada no índice da detecção
          const hue = (idx * 137) % 360;
          const color = `hsla(${hue}, 70%, 50%, 0.3)`;
          const borderColor = `hsl(${hue}, 70%, 50%)`;

          // Desenhar retângulo preenchido
          ctx.fillStyle = color;
          ctx.fillRect(px1, py1, width, height);

          // Desenhar borda
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(px1, py1, width, height);

          // Desenhar label
          const label = det.class_name || `Class ${det.class_id}`;
          ctx.fillStyle = borderColor;
          ctx.font = 'bold 14px Arial';
          const textWidth = ctx.measureText(label).width;
          
          // Fundo do label
          ctx.fillRect(px1, py1 - 20, textWidth + 8, 20);
          
          // Texto do label
          ctx.fillStyle = 'white';
          ctx.fillText(label, px1 + 4, py1 - 5);
        });
      }

      setIsLoading(false);
    };

    img.onerror = () => {
      setIsLoading(false);
    };
  }, [detections, imageUrl]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: isLoading ? 'none' : 'block' }}
    />
  );
};

export default FrameWithMask;
