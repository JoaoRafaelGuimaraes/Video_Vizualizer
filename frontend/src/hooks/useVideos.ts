import { useState, useEffect } from 'react'
import type { Video } from '../types/video'
import { videoAPI } from '../services/api'

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchVideos = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await videoAPI.getAllMiniVideos()
      
      if (data.status === 'ok') {
        setVideos(data.mini_videos)
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
    fetchVideos()
  }, [])

  return { videos, loading, error, refetch: fetchVideos }
}
