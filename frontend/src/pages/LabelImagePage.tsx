import { useParams, useNavigate } from 'react-router-dom'

function LabelImagePage() {
  const { videoKey, imageName } = useParams<{ videoKey: string; imageName: string }>()
  const navigate = useNavigate()
  return (
    <div className="full-video-container" style={{ padding: '1rem' }}>
      <button className="back-button" onClick={() => navigate(-1)}>← Voltar</button>
      <h1>Rotulagem de Imagem (Em breve)</h1>
      <p>Vídeo: {videoKey}</p>
      <p>Imagem: {imageName}</p>
      <p>Esta página será implementada posteriormente.</p>
    </div>
  )
}

export default LabelImagePage
