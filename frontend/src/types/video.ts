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
