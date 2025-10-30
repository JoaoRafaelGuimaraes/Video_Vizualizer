import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const HISTORY_LIMIT = 50;

const FullImagePage: React.FC = () => {
  const { videoName, frame } = useParams<{ videoName: string; frame: string }>();
  const navigate = useNavigate();
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [zoom, setZoom] = useState(1);
  const minZoom = 0.5;
  const maxZoom = 3;
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerBoxId, setPickerBoxId] = useState<string | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [classesLoading, setClassesLoading] = useState(false);
  const [savingMask, setSavingMask] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [panning, setPanning] = useState<null | { startMouse: { x: number; y: number }; startPan: { x: number; y: number } }>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);
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
  const [history, setHistory] = useState<Box[][]>([]);
  const suspendHistory = useRef(false);
  const boxesRef = useRef<Box[]>([]);
  const historyRef = useRef<Box[][]>([]);

  if (!videoName || !frame) {
    return <div>Imagem não encontrada.</div>;
  }

  const imageUrl = videoAPI.getDatasetImageUrl(`/api/dataset/images/${videoName}/${frame}`);

  const updateOverlaySize = useCallback(() => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    setOverlaySize({ width: rect.width, height: rect.height });
  }, []);

  const pushHistory = useCallback((snapshot: Box[]) => {
    if (suspendHistory.current) return;
    const cloned = snapshot.map((box) => ({ ...box }));
    setHistory((prev) => {
      if (cloned.length === 0 && prev.length === 0) return prev;
      const next = prev.length >= HISTORY_LIMIT ? [...prev.slice(1), cloned] : [...prev, cloned];
      return next;
    });
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = containerRef.current?.getBoundingClientRect();
    const originX = rect ? e.clientX - rect.left : 0;
    const originY = rect ? e.clientY - rect.top : 0;
    setZoom((prevZoom) => {
      const nextZoom = clamp(prevZoom * factor, minZoom, maxZoom);
      if (nextZoom === prevZoom) return prevZoom;
      if (rect) {
        setPan((prevPan) => {
          const worldX = (originX - prevPan.x) / prevZoom;
          const worldY = (originY - prevPan.y) / prevZoom;
          return {
            x: originX - worldX * nextZoom,
            y: originY - worldY * nextZoom,
          };
        });
      }
      return nextZoom;
    });
  };

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setPanning(null);
  }, []);

  const handleSaveMask = useCallback(async () => {
    if (!videoName || !frame) return;
    setSaveError(null);
    setSaveSuccess(false);
    setSavingMask(true);
    try {
      const detections = boxes.map((b) => ({
        bbox: [b.x1, b.y1, b.x2, b.y2],
        class_id: b.class_id ?? 0,
        class_name: b.class_name,
      }));
      await videoAPI.saveMask(videoName, frame, detections);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar máscara:', err);
      setSaveError(err?.message || 'Erro ao salvar máscara');
    } finally {
      setSavingMask(false);
    }
  }, [videoName, frame, boxes]);

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
        pushHistory(prev);
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
    updateOverlaySize();
    window.addEventListener('resize', updateOverlaySize);
    return () => window.removeEventListener('resize', updateOverlaySize);
  }, [updateOverlaySize]);

  useEffect(() => {
    updateOverlaySize();
  }, [zoom, updateOverlaySize]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setClassesLoading(true);
        setClassesError(null);
        const response = await fetch(`${API_BASE_URL}/api/analyse_image/get_classes`);
        if (!response.ok) {
          throw new Error('Falha ao carregar classes');
        }
        const data = await response.json();
        if (data.status !== 'ok' || !Array.isArray(data.classes)) {
          throw new Error('Resposta inválida ao carregar classes');
        }
        setClasses(data.classes);
      } catch (err: any) {
        console.error('Erro ao buscar classes:', err);
        setClassesError(err?.message || 'Erro ao carregar classes');
      } finally {
        setClassesLoading(false);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    const fetchMask = async () => {
      if (!videoName || !frame) return;
      try {
        const data = await videoAPI.getMask(videoName, frame);
        if (data.status === 'ok' && data.result.detections) {
          const maskBoxes: Box[] = data.result.detections.map((det, idx) => {
            const [x1, y1, x2, y2] = det.bbox;
            return {
              id: `mask-${idx}-${Math.random().toString(36).slice(2, 8)}`,
              x1,
              y1,
              x2,
              y2,
              class_name: det.class_name,
              class_id: det.class_id,
              source: 'user' as const,
            };
          });
          setBoxes(maskBoxes);
        }
      } catch (err: any) {
        console.warn('Nenhuma máscara salva encontrada ou erro ao carregar:', err);
      }
    };
    fetchMask();
  }, [videoName, frame]);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    const handleWindowMouseUp = (evt: MouseEvent) => {
      if (evt.button === 1) {
        setPanning(null);
      }
    };
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
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
    const tolerance = handleSizePx * zoom;
    const within = (pt: { X: number; Y: number }) => Math.abs(px - pt.X) <= tolerance && Math.abs(py - pt.Y) <= tolerance;
    for (const k of ['nw', 'ne', 'sw', 'se'] as const) if (within(corners[k])) return { hit: true, handle: k };
    for (const k of ['n', 's', 'w', 'e'] as const) if (within(edges[k])) return { hit: true, handle: k };
    return { hit: false };
  };

  const onOverlayMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.button === 1) {
      setPanning({ startMouse: { x: e.clientX, y: e.clientY }, startPan: { ...pan } });
      return;
    }
    if (e.button !== 0) return;
    const pos = getRelPos(e);
    // if clicked on selected box's handle, start resize
    if (selectedId) {
      const sel = boxes.find((b) => b.id === selectedId);
      if (sel) {
        const hit = nearHandle(pos, sel);
        if (hit.hit && hit.handle) {
          pushHistory(boxesRef.current);
          setDragging({ mode: 'resize', handle: hit.handle, startMouse: pos, startBox: { ...sel } });
          return;
        }
        // if inside selected box, start move
        if (pointInBox(pos, sel)) {
          pushHistory(boxesRef.current);
          setDragging({ mode: 'move', startMouse: pos, startBox: { ...sel } });
          return;
        }
      }
    }
    // if clicked inside any box, select it
    const hitBox = [...boxes].reverse().find((b) => pointInBox(pos, b));
    if (hitBox) {
      setSelectedId(hitBox.id);
      setPickerBoxId(hitBox.id);
      return;
    }
    // otherwise start drawing new box
    setSelectedId(null);
    setPickerBoxId(null);
    setDrawing({ startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y });
  };

  const onOverlayMouseMove = (e: React.MouseEvent) => {
    if (panning) {
      e.preventDefault();
      const dx = e.clientX - panning.startMouse.x;
      const dy = e.clientY - panning.startMouse.y;
      setPan({ x: panning.startPan.x + dx, y: panning.startPan.y + dy });
      return;
    }
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
    if (panning && e.button === 1) {
      setPanning(null);
      return;
    }
    if (e.button !== 0) return;
    const pos = getRelPos(e);
    if (drawing) {
      const n = normBox(drawing.startX, drawing.startY, pos.x, pos.y);
      const min = 0.005; // avoid tiny clicks
      if (n.x2 - n.x1 > min && n.y2 - n.y1 > min) {
        const newBox: Box = {
          id: `user-${Math.random().toString(36).slice(2, 9)}`,
          ...n,
          class_name: '',
          source: 'user',
        };
        setBoxes((prev) => {
          pushHistory(prev);
          return prev.concat(newBox);
        });
        setSelectedId(newBox.id);
        setPickerBoxId(newBox.id);
      }
      setDrawing(null);
    }
    if (dragging) setDragging(null);
  };

  const totalModel = useMemo(() => boxes.filter((b) => b.source === 'model').length, [boxes]);
  const totalUser = useMemo(() => boxes.filter((b) => b.source === 'user').length, [boxes]);
  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);
  const pickerBox = useMemo(() => boxes.find((b) => b.id === pickerBoxId) || null, [boxes, pickerBoxId]);
  const pickerSuggestions = useMemo(() => {
    if (!pickerBox || classes.length === 0) return [];
    const query = (pickerBox.class_name || '').trim().toLowerCase();
    const filtered = query ? classes.filter((cls) => cls.toLowerCase().includes(query)) : classes;
    const base = filtered.length > 0 ? filtered : classes;
    return base.slice(0, 5);
  }, [pickerBox, classes]);
  const pickerPosition = useMemo(() => {
    if (!pickerBox || overlaySize.width === 0 || overlaySize.height === 0) return null;
    const anchorX = pickerBox.x2 * overlaySize.width;
    const anchorY = pickerBox.y1 * overlaySize.height;
    const maxLeft = Math.max(overlaySize.width - 200, 8);
    const maxTop = Math.max(overlaySize.height - 160, 8);
    return {
      left: Math.min(Math.max(anchorX + 8, 8), maxLeft),
      top: Math.min(Math.max(anchorY - 8, 8), maxTop),
    };
  }, [pickerBox, overlaySize]);

  const updateLabel = useCallback(
    (id: string, newText: string) => {
      setBoxes((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx === -1) return prev;
        if (prev[idx].class_name === newText) return prev;
        pushHistory(prev);
        return prev.map((b) => (b.id === id ? { ...b, class_name: newText } : b));
      });
    },
    [pushHistory]
  );

  const deleteBox = useCallback(
    (id: string) => {
      let removed = false;
      setBoxes((prev) => {
        if (!prev.some((b) => b.id === id)) return prev;
        pushHistory(prev);
        removed = true;
        return prev.filter((b) => b.id !== id);
      });
      if (removed) {
        setActiveIds((prev) => prev.filter((x) => x !== id));
        setSelectedId((cur) => (cur === id ? null : cur));
        setPickerBoxId((cur) => (cur === id ? null : cur));
      }
    },
    [pushHistory]
  );

  useEffect(() => {
    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Delete' && selectedId) {
        evt.preventDefault();
        deleteBox(selectedId);
      }
      if ((evt.ctrlKey || evt.metaKey) && (evt.key === 'z' || evt.key === 'Z')) {
        if (historyRef.current.length === 0) return;
        evt.preventDefault();
        const snapshot = historyRef.current[historyRef.current.length - 1];
        suspendHistory.current = true;
        setBoxes(snapshot.map((box) => ({ ...box })));
        setActiveIds((ids) => ids.filter((id) => snapshot.some((box) => box.id === id)));
        setSelectedId(null);
        setHistory((prev) => prev.slice(0, -1));
        setTimeout(() => {
          suspendHistory.current = false;
        }, 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, deleteBox]);

  return (
    <div className="full-image-page">
      <div className="full-image-header">
        <button className="back-button" onClick={() => navigate('/rotulos')}>
          ← Voltar para Rótulos
        </button>
        <h1>Visualização de Frame</h1>
      </div>

      <div className="image-container-wrapper">
        <div ref={containerRef} className="image-container" onWheel={handleWheel} style={{ overflow: 'hidden' }}>
          <div
            className="zoom-stage"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
              position: 'relative',
              display: 'inline-block',
            }}
          >
            <img ref={imgRef} src={imageUrl} alt={`Frame ${frame} de ${videoName}`} onLoad={updateOverlaySize} />
            <div
              ref={overlayRef}
              className="draw-overlay"
              onMouseDown={onOverlayMouseDown}
              onMouseMove={onOverlayMouseMove}
              onMouseUp={onOverlayMouseUp}
              style={{ cursor: panning ? 'grabbing' : 'crosshair' }}
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
                                x={`${hx * 100}%`}
                                y={`${hy * 100}%`}
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
              {pickerBox && pickerSuggestions.length > 0 && pickerPosition && (
                <div className="bbox-suggestions" style={{ left: pickerPosition.left, top: pickerPosition.top }}>
                  {pickerSuggestions.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      className="bbox-suggestion"
                      onMouseDown={(evt) => {
                        evt.preventDefault();
                        updateLabel(pickerBox.id, cls);
                        setPickerBoxId(null);
                      }}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            className="reset-view-icon"
            onClick={resetView}
            title="Resetar visão"
            aria-label="Resetar visão"
          >
            ↺
          </button>
        </div>
      </div>

      <div className="labeling-container">
        <h2>Análise YOLO</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button className="view-full-button" disabled={analysing} onClick={handleAnalyse}>
            🔍 Analisar com YOLO
          </button>
          <button className="view-full-button" disabled={savingMask} onClick={handleSaveMask}>
            💾 Salvar Máscara
          </button>
          {analysing && (
            <div className="status-banner processing">
              <span className="loader" />
              <span>Analisando imagem… aguarde</span>
            </div>
          )}
          {savingMask && (
            <div className="status-banner processing">
              <span className="loader" />
              <span>Salvando máscara… aguarde</span>
            </div>
          )}
          {saveSuccess && <div className="status-banner success">Máscara salva com sucesso!</div>}
          {analysisError && <div className="status-banner error">{analysisError}</div>}
          {saveError && <div className="status-banner error">{saveError}</div>}
        </div>
        <div className="detections-summary">
          <p>
            <strong>{totalModel}</strong> objeto(s) do modelo • <strong>{totalUser}</strong> criado(s) pelo usuário •{' '}
            <strong>{zoomPercent}%</strong> zoom
          </p>
          <p className="zoom-hint">Segure Shift e use o scroll para aplicar zoom. Clique com o botão do meio para arrastar. Use Ctrl+Z para desfazer.</p>
          {classesLoading && (
            <div className="status-banner processing" style={{ marginTop: '0.5rem' }}>
              <span className="loader" />
              <span>Carregando lista de classes…</span>
            </div>
          )}
          {classesError && (
            <div className="status-banner error" style={{ marginTop: '0.5rem' }}>{classesError}</div>
          )}
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
                  onFocus={() => setPickerBoxId(b.id)}
                  onBlur={() => {
                    setTimeout(() => {
                      setPickerBoxId((cur) => (cur === b.id ? null : cur));
                    }, 150);
                  }}
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
                  <button
                    className="anno-action"
                    onClick={() => {
                      setSelectedId(b.id);
                      setPickerBoxId(b.id);
                    }}
                  >
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
