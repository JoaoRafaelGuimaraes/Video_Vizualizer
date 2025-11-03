import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Video } from '../types/video'
import { videoAPI, API_BASE_URL } from '../services/api'
import './VideoGrid.css'

interface VideoGridProps {
  videos: Video[]
}

interface VideoCardProps {
  video: Video
  index: number
  onViewFullVideo: (index: number) => void
}

function VideoCard({ video, index, onViewFullVideo }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)
  const [thumbnailLoading, setThumbnailLoading] = useState(true)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const hoverTimeoutRef = useRef<number | null>(null)
  
  const videoUrl = videoAPI.getMiniVideoUrl(video.mini_video_url)
  
  // Usar nova API de thumbnail que gera dinamicamente se necessário
  const videoFileName = video.mini_video_url.split('/').pop() || ''
  const thumbnailUrl = `${API_BASE_URL}/api/videos/thumbnail/${encodeURIComponent(videoFileName)}`
  
  // Extrair nome do arquivo da URL
  const fileName = video.mini_video_path ? 
    video.mini_video_path.split('/').pop() || 'video' : 
    video.mini_video_url.split('/').pop() || 'video'

  const handleThumbnailError = () => {
    console.warn(`Falha ao carregar thumbnail: ${thumbnailUrl}`)
    setThumbnailError(true)
    setThumbnailLoading(false)
  }

  const handleThumbnailLoad = () => {
    setThumbnailLoading(false)
  }

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('Erro ao carregar vídeo:', videoUrl)
    console.error('Erro detalhado:', e)
    setIsVideoLoading(false)
  }

  const handleVideoLoadStart = () => {
    setIsVideoLoading(true)
  }

  const handleVideoCanPlay = () => {
    setIsVideoLoading(false)
  }

  const formatDuration = (duration: number | undefined) => {
    if (!duration) return 'N/A'
    const minutes = Math.floor(duration / 60)
    const seconds = Math.floor(duration % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatResolution = (resolution: number[]) => {
    if (!resolution || resolution.length < 2) return 'N/A'
    return `${resolution[0]}x${resolution[1]}`
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
    // Delay de 500ms antes de começar a reproduzir o vídeo
    hoverTimeoutRef.current = window.setTimeout(() => {
      setShouldPlayVideo(true)
    }, 500)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setShouldPlayVideo(false)
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div 
      className="video-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="video-preview">
        {!shouldPlayVideo || thumbnailError ? (
          // Mostrar thumbnail quando não deve reproduzir vídeo ou quando thumbnail falhou
          <div className="thumbnail-container">
            {!thumbnailError ? (
              <>
                {thumbnailLoading && (
                  <div className="thumbnail-loading">
                    <div className="loading-spinner-small">⟳</div>
                    <span>Gerando thumbnail...</span>
                  </div>
                )}
                <img 
                  src={thumbnailUrl}
                  alt={`Thumbnail de ${fileName}`}
                  className={`video-thumbnail ${thumbnailLoading ? 'loading' : ''}`}
                  onError={handleThumbnailError}
                  onLoad={handleThumbnailLoad}
                />
              </>
            ) : (
              <div className="thumbnail-fallback">
                <div className="play-icon">▶️</div>
                <span>Vídeo</span>
              </div>
            )}
            <div className={`video-overlay ${isHovered ? 'visible' : ''}`}>
              <button 
                className="play-button"
                onClick={() => onViewFullVideo(index)}
                aria-label="Reproduzir vídeo"
              >
                ▶️
              </button>
              {isHovered && !shouldPlayVideo && (
                <div className="hover-hint">
                  Mantenha o cursor para ver prévia
                </div>
              )}
            </div>
          </div>
        ) : (
          // Mostrar miniatura quando deve reproduzir vídeo
          <div className="video-container-hover">
            <video
              key={`${video.mini_video_url}-hover`}
              autoPlay
              muted
              loop
              playsInline
              className="video-preview-player"
              src={videoUrl}
              onError={handleVideoError}
              onLoadStart={handleVideoLoadStart}
              onCanPlay={handleVideoCanPlay}
            >
              Seu navegador não suporta vídeos.
            </video>
            {isVideoLoading && (
              <div className="video-loading-overlay">
                <div className="loading-spinner-small">⟳</div>
              </div>
            )}
            <div className="video-overlay-playing">
              <button 
                className="play-button"
                onClick={() => onViewFullVideo(index)}
                aria-label="Ver vídeo completo"
              >
                🎬
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="video-info">
        <h3 className="video-title" title={fileName}>
          {fileName}
        </h3>
        <div className="video-stats">
          <span className="video-duration">
            ⏱️ {formatDuration(video.duration)}
          </span>
          <span className="video-resolution">
            � {formatResolution(video.resolution)}
          </span>
          <span className="video-fps">
            🎬 {video.fps ? `${video.fps.toFixed(0)} fps` : 'N/A'}
          </span>
        </div>
        
        <div className="video-actions">
          <button 
            className="view-full-button"
            onClick={() => onViewFullVideo(index)}
          >
            🎬 Ver Completo
          </button>
        </div>
      </div>
    </div>
  )
}

function VideoGrid({ videos }: VideoGridProps) {
  const navigate = useNavigate()

  const viewFullVideo = (index: number) => {
    navigate(`/video/${index}`)
  }

  if (videos.length === 0) {
    return (
      <div className="video-grid-empty">
        <div className="empty-state">
          📹 Nenhum vídeo encontrado
        </div>
      </div>
    )
  }

  return (
    <div className="video-grid-container">
      <div className="video-grid">
        {videos.map((video, index) => (
          <VideoCard 
            key={`${video.mini_video_url}-${index}`}
            video={video}
            index={index}
            onViewFullVideo={viewFullVideo}
          />
        ))}
      </div>
    </div>
  )
}

export default VideoGrid