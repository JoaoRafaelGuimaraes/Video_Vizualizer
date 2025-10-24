import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Video } from '../types/video'
import { videoAPI } from '../services/api'

interface VideosContextType {
  videos: Video[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const VideosContext = createContext<VideosContextType | undefined>(undefined)

export function VideosProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchVideos = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await videoAPI.getAllMiniVideos()
      console.log('📊 Dados recebidos da API:', data)
      
      if (data.status === 'ok') {
        console.log('📹 Vídeos carregados:', data.mini_videos)
        setVideos(data.mini_videos)
        setHasLoaded(true)
      } else {
        setError('Erro ao carregar vídeos')
      }
    } catch (err) {
      console.error('Erro ao buscar vídeos:', err)
      setError('Erro de conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Carrega apenas uma vez na primeira montagem
    if (!hasLoaded) {
      fetchVideos()
    }
  }, [hasLoaded])

  return (
    <VideosContext.Provider value={{ videos, loading, error, refetch: fetchVideos }}>
      {children}
    </VideosContext.Provider>
  )
}

export function useVideos() {
  const context = useContext(VideosContext)
  if (context === undefined) {
    throw new Error('useVideos deve ser usado dentro de VideosProvider')
  }
  return context
}
