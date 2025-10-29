import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useVideos } from '../context/VideosContext'
import { videoAPI } from '../services/api'
import './FullVideoPage.css'

function FullVideoPage() {
  const { videoIndex } = useParams<{ videoIndex: string }>()
  const navigate = useNavigate()
  const { videos, loading } = useVideos()
  const [analysing, setAnalysing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  

  if (loading) {
    return (
      <div className="full-video-container">
        <h2>Carregando...</h2>
      </div>
    )
  }

  const index = parseInt(videoIndex || '0', 10)
  const video = videos[index]

  // Debug
  console.log('FullVideoPage - videoIndex:', videoIndex)
  console.log('FullVideoPage - index:', index)
  console.log('FullVideoPage - videos.length:', videos.length)
  console.log('FullVideoPage - video:', video)

  if (!video) {
    return (
      <div className="full-video-container">
        <h2>Vídeo não encontrado</h2>
        <p>Index: {index}, Total de vídeos: {videos.length}</p>
        <button className="back-button" onClick={() => navigate('/')}>
          ← Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="full-video-container">
      <div className="full-video-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Voltar para Galeria
        </button>
        <h1>Vídeo Completo</h1>
      </div>

      <div className="full-video-content">
        <video
          controls
          autoPlay
          className="full-video-player"
          src={videoAPI.getFullVideoUrl(video.full_video_url)}
          onError={(e) => {
            console.error('Erro ao carregar vídeo completo:', video.full_video_url)
            console.error('Erro detalhado:', e)
          }}
        >
          Seu navegador não suporta vídeos.
        </video>

        <div className="full-video-info">
          <h2>Informações do Vídeo</h2>
          
          {/* Debug: Mostra dados brutos
          <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>
            <p>DEBUG - Raw Data:</p>
            <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
              {JSON.stringify({ 
                duration: video.duration, 
                fps: video.fps, 
                resolution: video.resolution 
              }, null, 2)}
            </pre>
          </div> */}

          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Duração:</span>
              <span className="info-value">
                {video.duration ? video.duration.toFixed(2) : 'N/A'}s
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">FPS:</span>
              <span className="info-value">{video.fps || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Resolução:</span>
              <span className="info-value">
                {video.resolution && video.resolution.length === 2 
                  ? `${video.resolution[0]} x ${video.resolution[1]}` 
                  : 'N/A'}
              </span>
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="view-full-button"
              disabled={analysing}
              onClick={async () => {
                setAnalysisError(null)
                setAnalysing(true)
                try {
                  // Backend expects filename; derive from full_video_url: /api/videos/<filename>
                  const parts = video.full_video_url.split('/')
                  const filenameEnc = parts[parts.length - 1]
                  const filename = decodeURIComponent(filenameEnc)
                  const res = await videoAPI.transformVideoToFrames(filename)
                  if (res.status !== 'ok') throw new Error('Falha ao transformar vídeo em frames')
                  setSuccessMessage('Frames adicionados ao Dataset com sucesso! Vá até a página Rótulos para visualizar.')
                  setTimeout(() => setSuccessMessage(null), 3000)
                  // Optional: navigate to Rótulos após sucesso
                  // navigate('/rotulos')
                } catch (err: any) {
                  console.error('Erro ao transformar vídeo em frames:', err)
                  setAnalysisError(err?.message || 'Erro ao transformar vídeo em frames')
                } finally {
                  setAnalysing(false)
                }
              }}
            >
              ➕ Adicionar Frames ao Dataset
            </button>
            {analysing && (
              <div className="status-banner processing">
                <span className="loader" />
                <span>Processando frames… aguarde</span>
              </div>
            )}
            {successMessage && (
              <div className="status-banner success">{successMessage}</div>
            )}
            {analysisError && (
              <div className="status-banner error">{analysisError}</div>
            )}
          </div>
        </div>
      </div>

      {/* Após adicionar frames ao dataset, visualize-os na página Rótulos */}
    </div>
  )
}

export default FullVideoPage
