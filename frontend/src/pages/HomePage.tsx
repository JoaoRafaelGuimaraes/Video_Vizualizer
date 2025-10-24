import { useVideos } from '../context/VideosContext'
import VideoCarousel from '../components/VideoCarousel'
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
      <h1>Galeria de Vídeos</h1>
      
      <VideoCarousel videos={videos} />

      <button className="reload-button" onClick={refetch}>
        🔄 Recarregar Vídeos
      </button>
    </div>
  )
}

export default HomePage
