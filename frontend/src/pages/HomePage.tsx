import { useVideos } from '../context/VideosContext'
import VideoGrid from '../components/VideoGrid'
import './HomePage.css'

function HomePage() {
  const { videos, loading, error, refetch } = useVideos()

  if (loading) {
    return (
      <div className="home-container">
        <h1>Carregando vídeos...</h1>
      </div>
    )
  }

  if (error) {
    return (
      <div className="home-container">
        <h1>Erro</h1>
        <p>{error}</p>
        <button className="reload-button" onClick={refetch}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="home-container">
        <h1>Nenhum vídeo encontrado</h1>
        <button className="reload-button" onClick={refetch}>
          🔄 Recarregar
        </button>
      </div>
    )
  }

  return (
    <div className="home-container">
      <div className="header-section">
        <h1>Galeria de Vídeos</h1>
        <div className="video-count">
          {videos.length} vídeo{videos.length !== 1 ? 's' : ''} encontrado{videos.length !== 1 ? 's' : ''}
        </div>
        <button className="reload-button" onClick={refetch}>
          🔄 Recarregar
        </button>
      </div>
      
      <VideoGrid videos={videos} />
    </div>
  )
}

export default HomePage
