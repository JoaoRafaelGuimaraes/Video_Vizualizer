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
  lazy?: boolean;
}

const FrameWithMask: React.FC<FrameWithMaskProps> = ({
  videoName,
  frameName,
  imageUrl,
  className = '',
  lazy = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isVisible, setIsVisible] = useState(!lazy);
  const [hasAnnotations, setHasAnnotations] = useState(false);

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (!lazy || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Carregar 50px antes de aparecer
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    // Reset ao mudar props
    setStatus('loading');
    setDetections([]);

    // 1. Carregar máscara (opcional)
    videoAPI.getMask(videoName, frameName)
      .then((data) => {
        const dets = data.result?.detections || [];
        setDetections(dets);
        setHasAnnotations(dets.length > 0);
      })
      .catch(() => {
        // Sem máscara, tudo bem
        setDetections([]);
        setHasAnnotations(false);
      });

    // 2. Criar e carregar imagem
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Verificar se a imagem tem dimensões válidas
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        imgRef.current = img;
        setStatus('ready');
      } else {
        setStatus('error');
      }
    };

    img.onerror = (e) => {
      console.warn(`Failed to load image: ${imageUrl}`, e);
      setStatus('error');
    };

    img.src = imageUrl;

    // Cleanup
    return () => {
      imgRef.current = null;
    };
  }, [videoName, frameName, imageUrl, isVisible]);

  // Desenhar no canvas quando status='ready' e detections mudar
  useEffect(() => {
    if (status !== 'ready') return;
    
    const canvas = canvasRef.current;
    const img = imgRef.current;
    
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calcular dimensões mantendo aspect ratio
    const targetWidth = 150;
    const targetHeight = (img.height / img.width) * targetWidth;

    // Configurar canvas com dimensões fixas para o carousel
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Desenhar imagem
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Desenhar detecções
    detections.forEach((det, idx) => {
      const [x1, y1, x2, y2] = det.bbox;

      // Converter para pixels do canvas redimensionado
      const px1 = x1 * canvas.width;
      const py1 = y1 * canvas.height;
      const px2 = x2 * canvas.width;
      const py2 = y2 * canvas.height;
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

  if (status === 'idle') {
    return (
      <div 
        ref={containerRef}
        className={`${className} frame-placeholder`}
        style={{ 
          width: '150px', 
          height: '100px', 
          background: '#f8f9fa',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6c757d',
          fontSize: '11px',
          border: '1px dashed #dee2e6'
        }}
      >
        📷
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div 
        className={`${className} frame-placeholder`}
        style={{ 
          width: '150px', 
          height: '100px', 
          background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
          backgroundSize: '200% 100%',
          animation: 'loading 1.5s infinite',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '11px'
        }}
      >
        Carregando...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div 
        className={`${className} frame-placeholder error`}
        style={{ 
          width: '150px', 
          height: '100px', 
          background: 'linear-gradient(135deg, #fff5f5, #fed7d7)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e53e3e',
          fontSize: '11px',
          textAlign: 'center',
          padding: '8px',
          border: '2px dashed #feb2b2'
        }}
      >
        <div style={{ fontSize: '16px', marginBottom: '4px' }}>⚠️</div>
        <div>Erro ao carregar</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={hasAnnotations ? 'frame-container has-annotations' : 'frame-container'}>
      <canvas ref={canvasRef} className={className} />
    </div>
  );
};

export default FrameWithMask;
