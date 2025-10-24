import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Video } from '../types/video'
import VideoPlayer from './VideoPlayer'
import VideoInfo from './VideoInfo'
import CarouselDots from './CarouselDots'
import './VideoCarousel.css'

interface VideoCarouselProps {
  videos: Video[]
}

function VideoCarousel({ videos }: VideoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const navigate = useNavigate()

  const nextVideo = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length)
  }

  const prevVideo = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length)
  }

  const goToVideo = (index: number) => {
    setCurrentIndex(index)
  }

  const viewFullVideo = () => {
    navigate(`/video/${currentIndex}`)
  }

  if (videos.length === 0) {
    return null
  }

  const currentVideo = videos[currentIndex]

  return (
    <div className="carousel-wrapper">
      <div className="carousel">
        <button 
          className="carousel-button prev" 
          onClick={prevVideo}
          disabled={videos.length <= 1}
          aria-label="Vídeo anterior"
        >
          ❮
        </button>

        <div className="video-container">
          <VideoPlayer video={currentVideo} />
          <VideoInfo 
            video={currentVideo} 
            currentIndex={currentIndex} 
            totalVideos={videos.length} 
          />
          <button className="view-full-button" onClick={viewFullVideo}>
            🎬 VER VÍDEO COMPLETO
          </button>
        </div>

        <button 
          className="carousel-button next" 
          onClick={nextVideo}
          disabled={videos.length <= 1}
          aria-label="Próximo vídeo"
        >
          ❯
        </button>
      </div>

      <CarouselDots 
        total={videos.length} 
        currentIndex={currentIndex} 
        onDotClick={goToVideo} 
      />
    </div>
  )
}

export default VideoCarousel
