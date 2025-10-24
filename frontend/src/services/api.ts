const API_BASE_URL = 'http://localhost:5000'

export const videoAPI = {
  async getAllMiniVideos() {
    const response = await fetch(`${API_BASE_URL}/api/get_mini_video`)
    if (!response.ok) {
      throw new Error('Erro ao buscar vídeos')
    }
    return response.json()
  },

  getMiniVideoUrl(videoUrl: string) {
    return `${API_BASE_URL}${videoUrl}`
  },

  getFullVideoUrl(videoUrl: string) {
    return `${API_BASE_URL}${videoUrl}`
  },

  async testConnection() {
    const response = await fetch(`${API_BASE_URL}/api/test`)
    return response.json()
  }
}
