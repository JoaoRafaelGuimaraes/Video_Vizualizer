import type { Video } from '../types/video'
import './VideoInfo.css'

interface VideoInfoProps {
  video: Video
  currentIndex: number
  totalVideos: number
}

function VideoInfo({ video, currentIndex, totalVideos }: VideoInfoProps) {
  // Debug: mostra os dados do vídeo no console
  console.log('VideoInfo - dados do vídeo:', video)
  console.log('VideoInfo - duration:', video.duration)
  console.log('VideoInfo - fps:', video.fps)
  console.log('VideoInfo - resolution:', video.resolution)
  
  // Verificação de segurança
  if (!video) {
    return (
      <div className="video-info">
        <p>Carregando informações...</p>
      </div>
    )
  }
  
  return (
    <div className="video-info">
      <p><strong>Vídeo {currentIndex + 1} de {totalVideos}</strong></p>
      <p>Duração: {video.duration ? video.duration.toFixed(2) : 'N/A'}s</p>
      <p>FPS: {video.fps || 'N/A'}</p>
      <p>Resolução: {video.resolution && video.resolution.length === 2 
        ? `${video.resolution[0]} x ${video.resolution[1]}` 
        : 'N/A'}</p>
    </div>
  )
}

export default VideoInfo
