export interface Video {
  duration: number
  fps: number
  resolution: number[]
  mini_video_path: string
  mini_video_url: string
  full_video_url: string
}

export interface VideosResponse {
  status: string
  mini_videos: Video[]
}

export interface DetectionBox {
  bbox_xyxy: [number, number, number, number]
  bbox_yolo: [number, number, number, number]
  confidence: number
  class_id: number
  class_name: string
}

export interface AnalysisFrame {
  image_name: string
  image_url: string // backend relative URL; resolve with videoAPI.getDatasetImageUrl
  detections: DetectionBox[]
}
