import React, { useState, useEffect } from 'react';
import { videoAPI } from '../services/api';
import { Link } from 'react-router-dom';
import './RotulosPage.css';

const RotulosPage: React.FC = () => {
  const [datasets, setDatasets] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [frames, setFrames] = useState<string[]>([]);

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
    try {
      const data = await videoAPI.getDatasetVideoFrames(dataset);
      setFrames(data.frames || []);
      setSelectedDataset(dataset);
    } catch (error) {
      console.error('Error fetching frames:', error);
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
        <div className="frames-carousel">
          <h2>Frames de {selectedDataset}</h2>
          <div className="carousel-container">
            {frames.map((frame) => (
              <Link key={frame} to={`/rotulos/${selectedDataset}/${frame}`}>
                <img
                  src={videoAPI.getDatasetImageUrl(`/api/dataset/images/${selectedDataset}/${frame}`)}
                  alt={frame}
                  className="carousel-image"
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RotulosPage;
