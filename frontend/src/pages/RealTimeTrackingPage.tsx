import React, { useState, useRef, useEffect } from 'react';
import { useVideos } from '../hooks/useVideos';
import { API_BASE_URL } from '../services/api';
import './RealTimeTrackingPage.css';

interface Point {
  x: number;
  y: number;
}

const RealTimeTrackingPage: React.FC = () => {
  const { videos } = useVideos();
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [polygon, setPolygon] = useState<Point[]>([]);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  // Atualiza a URL do stream quando um vídeo é selecionado
  useEffect(() => {
    if (selectedVideo) {
      const videoFilename = selectedVideo.split('/').pop();
      setStreamUrl(`${API_BASE_URL}/api/video_stream/${videoFilename}`);
    }
  }, [selectedVideo]);

  // Desenha o retângulo no canvas
  const drawRectangle = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha o retângulo se existir
    if (polygon.length === 2) {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        polygon[0].x,
        polygon[0].y,
        polygon[1].x - polygon[0].x,
        polygon[1].y - polygon[0].y
      );
    }

    // Desenha o retângulo temporário durante o desenho
    if (isDrawing && startPoint && polygon.length === 1) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        startPoint.x,
        startPoint.y,
        polygon[0].x - startPoint.x,
        polygon[0].y - startPoint.y
      );
      ctx.setLineDash([]);
    }
  };

  useEffect(() => {
    drawRectangle();
  }, [polygon, isDrawing, startPoint]);

  // Ajusta o canvas quando a imagem é carregada
  const handleImageLoad = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    drawRectangle();
  };

  // Captura o início do desenho
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setPolygon([{ x, y }]);
  };

  // Atualiza o ponto final durante o desenho
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPolygon([startPoint, { x, y }]);
  };

  // Finaliza o desenho
  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  // Envia o polígono para o backend
  const handleSendPolygon = async () => {
    if (polygon.length !== 2) {
      setMessage('Desenhe um retângulo primeiro!');
      return;
    }

    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    // Converte o retângulo em 4 pontos (formato polígono)
    const [p1, p2] = polygon;
    const rectanglePoints = [
      { x: p1.x, y: p1.y }, // top-left
      { x: p2.x, y: p1.y }, // top-right
      { x: p2.x, y: p2.y }, // bottom-right
      { x: p1.x, y: p2.y }, // bottom-left
    ];

    // Normaliza as coordenadas para 0-1 baseado no tamanho da imagem exibida
    const normalizedPolygon = rectanglePoints.map((point) => ({
      x: point.x / img.clientWidth,
      y: point.y / img.clientHeight,
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/update_polygon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          polygon_points: normalizedPolygon,
        }),
      });

      if (response.ok) {
        setMessage('✓ Área de risco definida com sucesso!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('✗ Erro ao enviar área de risco');
      }
    } catch (error) {
      console.error('Erro ao enviar polígono:', error);
      setMessage('✗ Erro de conexão com o servidor');
    }
  };

  // Limpa o polígono
  const handleClearPolygon = () => {
    setPolygon([]);
    setStartPoint(null);
    setMessage('');
  };

  return (
    <div className="realtime-tracking-page">
      <h1>Rastreamento em Tempo Real</h1>

      <div className="controls">
        <div className="video-selector">
          <label htmlFor="video-select">Selecione um vídeo:</label>
          <select
            id="video-select"
            value={selectedVideo}
            onChange={(e) => setSelectedVideo(e.target.value)}
          >
            <option value="">-- Escolha um vídeo --</option>
            {videos.map((video, index) => (
              <option key={index} value={video.full_video_url}>
                {video.full_video_url.split('/').pop()}
              </option>
            ))}
          </select>
        </div>

        {selectedVideo && (
          <div className="polygon-controls">
            <button onClick={handleSendPolygon} className="btn-send">
              Definir Área de Risco
            </button>
            <button onClick={handleClearPolygon} className="btn-clear">
              Limpar Área
            </button>
          </div>
        )}

        {message && <div className="message">{message}</div>}
      </div>

      {selectedVideo && streamUrl && (
        <div className="video-container">
          <div className="canvas-wrapper">
            <img
              ref={imgRef}
              src={streamUrl}
              alt="Video Stream"
              className="video-stream"
              onLoad={handleImageLoad}
              crossOrigin="anonymous"
            />
            <canvas
              ref={canvasRef}
              className="drawing-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
          <div className="instructions">
            <p>🖱️ Clique e arraste para desenhar um retângulo representando a área de risco</p>
          </div>
        </div>
      )}

      {!selectedVideo && (
        <div className="no-video-selected">
          <p>Selecione um vídeo para começar o rastreamento</p>
        </div>
      )}
    </div>
  );
};

export default RealTimeTrackingPage;
