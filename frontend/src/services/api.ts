export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export const videoAPI = {
  // Mini videos list (Gallery)
  async getAllMiniVideos() {
    const response = await fetch(`${API_BASE_URL}/api/get_mini_video`)
    if (!response.ok) {
      throw new Error('Erro ao buscar vídeos')
    }
    return response.json()
  },

  // URLs helpers (backend returns relative URLs)
  getMiniVideoUrl(videoUrl: string) {
    return `${API_BASE_URL}${videoUrl}`
  },

  getFullVideoUrl(videoUrl: string) {
    return `${API_BASE_URL}${videoUrl}`
  },

  getDatasetImageUrl(relUrl: string) {
    // Accepts backend relative URLs like /api/dataset/images/<video>/<image>.jpg
    return `${API_BASE_URL}${relUrl}`
  },

  // Health check
  async testConnection() {
    const response = await fetch(`${API_BASE_URL}/api/test`)
    return response.json()
  },

  // Run analysis (existing feature)
  async analyseVideo(filename: string) {
    const response = await fetch(`${API_BASE_URL}/api/analyse_video/${encodeURIComponent(filename)}`)
    if (!response.ok) {
      throw new Error('Erro ao analisar vídeo')
    }
    return response.json() as Promise<{
      status: string
      result_dir: string
      frames?: Array<{
        image_name: string
        image_url: string // backend relative URL; resolve with videoAPI.getDatasetImageUrl
        detections: Array<{
          bbox_xyxy: [number, number, number, number]
          bbox_yolo: [number, number, number, number]
          confidence: number
          class_id: number
          class_name: string
        }>
      }>
    }>
  },

  // New: dataset management for labeling flow
  async transformVideoToFrames(videoFilename: string) {
    const response = await fetch(`${API_BASE_URL}/api/dataset/transform_video/${encodeURIComponent(videoFilename)}`)
    if (!response.ok) {
      throw new Error('Erro ao transformar vídeo em frames')
    }
    return response.json()
  },

  async getDatasetVideos() {
    const response = await fetch(`${API_BASE_URL}/api/dataset/videos`)
    if (!response.ok) {
      throw new Error('Erro ao buscar datasets de vídeos')
    }
    return response.json() as Promise<{ status: string; datasets: string[] }>
  },

  async getDatasetVideoFrames(videoName: string) {
    const response = await fetch(`${API_BASE_URL}/api/dataset/videos/${encodeURIComponent(videoName)}`)
    if (!response.ok) {
      throw new Error('Erro ao buscar frames do dataset')
    }
    return response.json() as Promise<{ status: string; frames: string[] }>
  },
}
