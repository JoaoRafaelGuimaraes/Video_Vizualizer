import type { Video } from '../types/video'
import { videoAPI } from '../services/api'
import './VideoPlayer.css'

interface VideoPlayerProps {
  video: Video
}

function VideoPlayer({ video }: VideoPlayerProps) {
  const videoUrl = videoAPI.getMiniVideoUrl(video.mini_video_url)
  
  return (
    <video
      key={video.mini_video_url}
      controls
      autoPlay
      muted
      loop
      playsInline
      className="video-player"
      src={videoUrl}
      onError={(e) => {
        console.error('Erro ao carregar vídeo:', videoUrl)
        console.error('Erro detalhado:', e)
      }}
    >
      Seu navegador não suporta vídeos.
    </video>
  )
}

export default VideoPlayer
