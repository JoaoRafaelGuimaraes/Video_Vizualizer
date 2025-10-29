import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL, videoAPI } from '../services/api';
import './FullImagePage.css';

interface Detection {
  bbox: [number, number, number, number]; // normalized [x1, y1, x2, y2]
  confidence: number;
  class_id: number;
  class_name: string;
}

interface AnalysisResult {
  detections: Detection[];
  img_shape: [number, number]; // [height, width]
  img_path: string;
}

type Box = {
  id: string;
  x1: number; // normalized 0..1
  y1: number; // normalized 0..1
  x2: number; // normalized 0..1
  y2: number; // normalized 0..1
  class_name: string;
  class_id?: number;
  confidence?: number;
  source: 'model' | 'user';
};

const FullImagePage: React.FC = () => {
  const { videoName, frame } = useParams<{ videoName: string; frame: string }>();
  const navigate = useNavigate();
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [overlaySize, setOverlaySize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [drawing, setDrawing] = useState<null | { startX: number; startY: number; curX: number; curY: number }>(null);
  const [dragging, setDragging] = useState<
    | null
    | {
        mode: 'move' | 'resize';
        handle?: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
        startMouse: { x: number; y: number };
        startBox: Box;
      }
  >(null);

  if (!videoName || !frame) {
    return <div>Imagem não encontrada.</div>;
  }

  const imageUrl = videoAPI.getDatasetImageUrl(`/api/dataset/images/${videoName}/${frame}`);

  const handleAnalyse = async () => {
    setAnalysisError(null);
    setAnalysing(true);
    // keep any user-added boxes; we'll merge model ones by replacing previous model results
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/analyse_image/${encodeURIComponent(videoName)}/${encodeURIComponent(frame)}`
      );
      if (!response.ok) {
        throw new Error('Erro ao analisar imagem');
      }
      const data = await response.json();
      if (data.status !== 'ok') {
        throw new Error(data.error || 'Falha na análise');
      }
      const result: AnalysisResult = data.result;
      // map detections to Box (normalized values already)
      const modelBoxes: Box[] = (result.detections || []).map((det: Detection, idx: number) => {
        const [x1, y1, x2, y2] = det.bbox;
        return {
          id: `model-${idx}-${Math.random().toString(36).slice(2, 8)}`,
          x1,
          y1,
          x2,
          y2,
          class_name: det.class_name,
          class_id: det.class_id,
          confidence: det.confidence,
          source: 'model',
        };
      });

      // Remove previous model boxes and append new ones, keep user-created
      setBoxes((prev) => {
        const userOnly = prev.filter((b) => b.source !== 'model');
        return [...userOnly, ...modelBoxes];
      });
    } catch (err: any) {
      console.error('Erro ao analisar imagem:', err);
      setAnalysisError(err?.message || 'Erro ao analisar imagem');
    } finally {
      setAnalysing(false);
    }
  };

  // overlay sizing
  useEffect(() => {
    const updateSize = () => {
      if (!overlayRef.current) return;
      setOverlaySize({
        width: overlayRef.current.clientWidth,
        height: overlayRef.current.clientHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const getRelPos = (e: React.MouseEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  };

  const normBox = (x1: number, y1: number, x2: number, y2: number) => {
    const nx1 = Math.min(x1, x2);
    const nx2 = Math.max(x1, x2);
    const ny1 = Math.min(y1, y2);
    const ny2 = Math.max(y1, y2);
    return { x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
  };

  const pointInBox = (p: { x: number; y: number }, b: Box) => p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2;

  const handleSizePx = 10;
  const nearHandle = (p: { x: number; y: number }, b: Box): { hit: boolean; handle?: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' } => {
    const { width, height } = overlaySize;
    if (!width || !height) return { hit: false };
    const toPx = (x: number, y: number) => ({ X: x * width, Y: y * height });
    const corners = {
      nw: toPx(b.x1, b.y1),
      ne: toPx(b.x2, b.y1),
      sw: toPx(b.x1, b.y2),
      se: toPx(b.x2, b.y2),
    };
    const edges = {
      n: toPx((b.x1 + b.x2) / 2, b.y1),
      s: toPx((b.x1 + b.x2) / 2, b.y2),
      w: toPx(b.x1, (b.y1 + b.y2) / 2),
      e: toPx(b.x2, (b.y1 + b.y2) / 2),
    };
    const px = p.x * width;
    const py = p.y * height;
    const within = (pt: { X: number; Y: number }) => Math.abs(px - pt.X) <= handleSizePx && Math.abs(py - pt.Y) <= handleSizePx;
    for (const k of ['nw', 'ne', 'sw', 'se'] as const) if (within(corners[k])) return { hit: true, handle: k };
    for (const k of ['n', 's', 'w', 'e'] as const) if (within(edges[k])) return { hit: true, handle: k };
    return { hit: false };
  };

  const onOverlayMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getRelPos(e);
    // if clicked on selected box's handle, start resize
    if (selectedId) {
      const sel = boxes.find((b) => b.id === selectedId);
      if (sel) {
        const hit = nearHandle(pos, sel);
        if (hit.hit && hit.handle) {
          setDragging({ mode: 'resize', handle: hit.handle, startMouse: pos, startBox: { ...sel } });
          return;
        }
        // if inside selected box, start move
        if (pointInBox(pos, sel)) {
          setDragging({ mode: 'move', startMouse: pos, startBox: { ...sel } });
          return;
        }
      }
    }
    // if clicked inside any box, select it
    const hitBox = [...boxes].reverse().find((b) => pointInBox(pos, b));
    if (hitBox) {
      setSelectedId(hitBox.id);
      return;
    }
    // otherwise start drawing new box
    setSelectedId(null);
    setDrawing({ startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y });
  };

  const onOverlayMouseMove = (e: React.MouseEvent) => {
    const pos = getRelPos(e);
    if (drawing) {
      setDrawing({ ...drawing, curX: pos.x, curY: pos.y });
    } else if (dragging && selectedId) {
      const { mode, startMouse, startBox, handle } = dragging;
      const dx = pos.x - startMouse.x;
      const dy = pos.y - startMouse.y;
      setBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== selectedId) return b;
          if (mode === 'move') {
            const w = startBox.x2 - startBox.x1;
            const h = startBox.y2 - startBox.y1;
            let nx1 = startBox.x1 + dx;
            let ny1 = startBox.y1 + dy;
            nx1 = Math.max(0, Math.min(1 - w, nx1));
            ny1 = Math.max(0, Math.min(1 - h, ny1));
            return { ...b, x1: nx1, y1: ny1, x2: nx1 + w, y2: ny1 + h };
          } else {
            // resize
            let { x1, y1, x2, y2 } = startBox;
            if (handle?.includes('w')) x1 = Math.max(0, Math.min(1, x1 + dx));
            if (handle?.includes('e')) x2 = Math.max(0, Math.min(1, x2 + dx));
            if (handle?.includes('n')) y1 = Math.max(0, Math.min(1, y1 + dy));
            if (handle?.includes('s')) y2 = Math.max(0, Math.min(1, y2 + dy));
            const n = normBox(x1, y1, x2, y2);
            return { ...b, ...n };
          }
        })
      );
    }
  };

  const onOverlayMouseUp = (e: React.MouseEvent) => {
    const pos = getRelPos(e);
    if (drawing) {
      const n = normBox(drawing.startX, drawing.startY, pos.x, pos.y);
      const min = 0.005; // avoid tiny clicks
      if (n.x2 - n.x1 > min && n.y2 - n.y1 > min) {
        const newBox: Box = {
          id: `user-${Math.random().toString(36).slice(2, 9)}`,
          ...n,
          class_name: 'objeto',
          source: 'user',
        };
        setBoxes((prev) => prev.concat(newBox));
        setSelectedId(newBox.id);
      }
      setDrawing(null);
    }
    if (dragging) setDragging(null);
  };

  const totalModel = useMemo(() => boxes.filter((b) => b.source === 'model').length, [boxes]);
  const totalUser = useMemo(() => boxes.filter((b) => b.source === 'user').length, [boxes]);

  const updateLabel = (id: string, newText: string) => {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, class_name: newText } : b)));
  };

  const deleteBox = (id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    setActiveIds((prev) => prev.filter((x) => x !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  return (
    <div className="full-image-page">
      <div className="full-image-header">
        <button className="back-button" onClick={() => navigate('/rotulos')}>
          ← Voltar para Rótulos
        </button>
        <h1>Visualização de Frame</h1>
      </div>

      <div className="image-container-wrapper">
        <div className="image-container">
          <img ref={imgRef} src={imageUrl} alt={`Frame ${frame} de ${videoName}`} onLoad={() => {
            // sync overlay size after image loads
            if (overlayRef.current) {
              setOverlaySize({
                width: overlayRef.current.clientWidth,
                height: overlayRef.current.clientHeight,
              });
            }
          }} />
          <div
            ref={overlayRef}
            className="draw-overlay"
            onMouseDown={onOverlayMouseDown}
            onMouseMove={onOverlayMouseMove}
            onMouseUp={onOverlayMouseUp}
          >
            <svg width="100%" height="100%">
              {/* existing boxes */}
              {boxes.map((b) => {
                const x = b.x1 * 100;
                const y = b.y1 * 100;
                const w = (b.x2 - b.x1) * 100;
                const h = (b.y2 - b.y1) * 100;
                const selected = selectedId === b.id;
                const isActive = activeIds.includes(b.id);
                return (
                  <g key={b.id} className={`box-group ${selected ? 'selected' : ''} ${b.source}`}>
                    <rect
                      x={`${x}%`}
                      y={`${y}%`}
                      width={`${w}%`}
                      height={`${h}%`}
                      className={`box-rect ${isActive ? 'active' : ''}`}
                    />
                    {/* label bubble */}
                    <text x={`${x}%`} y={`${y}%`} className={`box-label ${b.source}`}>
                      {b.class_name}
                    </text>
                    {/* resize handles when selected */}
                    {selected && overlaySize.width > 0 && overlaySize.height > 0 && (
                      <>
                        {([['nw', b.x1, b.y1], ['ne', b.x2, b.y1], ['sw', b.x1, b.y2], ['se', b.x2, b.y2], ['n', (b.x1 + b.x2) / 2, b.y1], ['s', (b.x1 + b.x2) / 2, b.y2], ['w', b.x1, (b.y1 + b.y2) / 2], ['e', b.x2, (b.y1 + b.y2) / 2]] as const).map(
                          ([key, hx, hy]) => (
                            <rect
                              key={key}
                              x={`${(hx * 100)}%`}
                              y={`${(hy * 100)}%`}
                              width={handleSizePx}
                              height={handleSizePx}
                              className="box-handle"
                              transform={`translate(-${handleSizePx / 2}, -${handleSizePx / 2})`}
                            />
                          )
                        )}
                      </>
                    )}
                  </g>
                );
              })}
              {/* drawing ghost */}
              {drawing && (
                (() => {
                  const n = normBox(drawing.startX, drawing.startY, drawing.curX, drawing.curY);
                  const x = n.x1 * 100;
                  const y = n.y1 * 100;
                  const w = (n.x2 - n.x1) * 100;
                  const h = (n.y2 - n.y1) * 100;
                  return <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} className="anno-ghost-svg" />;
                })()
              )}
            </svg>
          </div>
        </div>
      </div>

      <div className="labeling-container">
        <h2>Análise YOLO</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <button className="view-full-button" disabled={analysing} onClick={handleAnalyse}>
            🔍 Analisar com YOLO
          </button>
          {analysing && (
            <div className="status-banner processing">
              <span className="loader" />
              <span>Analisando imagem… aguarde</span>
            </div>
          )}
          {analysisError && <div className="status-banner error">{analysisError}</div>}
        </div>
        <div className="detections-summary">
          <p>
            <strong>{totalModel}</strong> objeto(s) do modelo • <strong>{totalUser}</strong> criado(s) pelo usuário
          </p>
        </div>

        {/* Editable list */}
        {boxes.length > 0 && (
          <div className="anno-list">
            {boxes.map((b) => (
              <div key={b.id} className={`anno-list-item ${b.source}`}>
                <div className="anno-badge" title={b.source === 'model' ? 'Modelo' : 'Usuário'}>
                  {b.source === 'model' ? 'M' : 'U'}
                </div>
                <input
                  className="anno-list-input"
                  value={b.class_name || ''}
                  onChange={(e) => updateLabel(b.id, e.target.value)}
                />
                <div className="anno-actions">
                  <button
                    className="anno-action"
                    onClick={() =>
                      setActiveIds((prev) => (prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]))
                    }
                  >
                    {activeIds.includes(b.id) ? 'Ocultar' : 'Destacar'}
                  </button>
                  <button className="anno-action" onClick={() => setSelectedId(b.id)}>
                    Selecionar
                  </button>
                  <button className="anno-action danger" onClick={() => deleteBox(b.id)}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FullImagePage;
