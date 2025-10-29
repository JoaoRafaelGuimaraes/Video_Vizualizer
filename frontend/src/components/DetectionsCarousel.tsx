import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AnalysisFrame } from '../types/video'
import { videoAPI } from '../services/api'
import './VideoCarousel.css'

interface DetectionsCarouselProps {
  frames: AnalysisFrame[]
  videoKey: string // e.g., original filename to keep context for labeling route
}

function DetectionsCarousel({ frames, videoKey }: DetectionsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const navigate = useNavigate()

  if (!frames || frames.length === 0) return null

  const next = () => setCurrentIndex((i) => (i + 1) % frames.length)
  const prev = () => setCurrentIndex((i) => (i - 1 + frames.length) % frames.length)

  const current = frames[currentIndex]

  const handleClickImage = () => {
    // Navigate to placeholder labeling page (not implemented yet)
    navigate(`/label/${encodeURIComponent(videoKey)}/${encodeURIComponent(current.image_name)}`)
  }

  return (
    <div className="carousel-wrapper">
      <div className="carousel">
        <button className="carousel-button prev" onClick={prev} aria-label="Frame anterior">❮</button>
        <div className="video-container">
          <div className="full-image-wrapper" style={{ position: 'relative' }}>
            <img
              src={videoAPI.getDatasetImageUrl(current.image_url)}
              alt={current.image_name}
              className="full-video-player"
              style={{ cursor: 'pointer' }}
              onClick={handleClickImage}
            />
            {/* Simple overlay of detections as boxes (optional minimal) */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {current.detections?.map((det, idx) => {
                const [x1, y1, x2, y2] = det.bbox_xyxy
                const left = `${x1 * 100}%`
                const top = `${y1 * 100}%`
                const width = `${(x2 - x1) * 100}%`
                const height = `${(y2 - y1) * 100}%`
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left,
                      top,
                      width,
                      height,
                      border: '2px solid #00E7FF',
                      boxShadow: '0 0 4px rgba(0,231,255,0.6) inset',
                    }}
                    title={`${det.class_name} ${(det.confidence * 100).toFixed(1)}%`}
                  />
                )
              })}
            </div>
          </div>
          <div className="video-info">
            <div className="video-title">Frames com detecções</div>
            <div className="video-meta">{currentIndex + 1} / {frames.length}</div>
          </div>
        </div>
        <button className="carousel-button next" onClick={next} aria-label="Próximo frame">❯</button>
      </div>
    </div>
  )
}

export default DetectionsCarousel
