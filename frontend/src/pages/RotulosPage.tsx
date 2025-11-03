import React, { useState, useEffect } from 'react';
import { videoAPI } from '../services/api';
import { Link } from 'react-router-dom';
import FrameWithMask from '../components/FrameWithMask';
import './RotulosPage.css';

const RotulosPage: React.FC = () => {
  const [datasets, setDatasets] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [isLoadingFrames, setIsLoadingFrames] = useState(false);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const data = await videoAPI.getDatasetVideos();
        setDatasets(data.datasets || []);
      } catch (error) {
        console.error('Error fetching datasets:', error);
      }
    };
    fetchDatasets();
  }, []);

  const handleDatasetClick = async (dataset: string) => {
    setIsLoadingFrames(true);
    setFrames([]);
    setSelectedDataset(dataset);
    try {
      const data = await videoAPI.getDatasetVideoFrames(dataset);
      // Ordenar frames por id numérico extraído do nome (ex: frame_0123.jpg -> 123)
      const framesArr: string[] = data.frames || [];
      const sorted = framesArr.slice().sort((a, b) => {
        const re = /frame_0*(\d+)\.jpg$/i;
        const ma = a.match(re);
        const mb = b.match(re);
        const na = ma ? parseInt(ma[1], 10) : NaN;
        const nb = mb ? parseInt(mb[1], 10) : NaN;
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        if (!isNaN(na)) return -1;
        if (!isNaN(nb)) return 1;
        return a.localeCompare(b);
      });
      setFrames(sorted);
    } catch (error) {
      console.error('Error fetching frames:', error);
    } finally {
      setIsLoadingFrames(false);
    }
  };

  return (
    <div className="rotulos-page">
      <h1>Rótulos</h1>
      {datasets.length === 0 ? (
        <p>Nenhum dataset encontrado. Transforme um vídeo em frames na Galeria de Vídeos.</p>
      ) : (
        <div className="datasets-carousel">
          <h2>Vídeos Transformados</h2>
          <div className="carousel-container">
            {datasets.map((dataset) => (
              <div key={dataset} className="carousel-item" onClick={() => handleDatasetClick(dataset)}>
                <p>{dataset}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedDataset && (
        <div className="frames-section">
          <h2>Frames de {selectedDataset}</h2>
          {isLoadingFrames ? (
            <div className="loading-frames">
              <p>Carregando frames...</p>
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <>
              <p className="frames-count">{frames.length} frames encontrados</p>
              <div className="frames-grid">
                {frames.map((frame, index) => (
                  <Link key={frame} to={`/rotulos/${selectedDataset}/${frame}`} className="frame-link">
                    <FrameWithMask
                      videoName={selectedDataset}
                      frameName={frame}
                      imageUrl={videoAPI.getDatasetImageUrl(`/api/dataset/images/${encodeURIComponent(selectedDataset)}/${encodeURIComponent(frame)}`)}
                      className="frame-image"
                      lazy={index > 10} // Carregar os primeiros 10 imediatamente
                    />
                    <div className="frame-name">{frame}</div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RotulosPage;
