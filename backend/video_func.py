import os
from moviepy import VideoFileClip
from PIL import Image

def get_minivideo(video_path):
    try:
        
        mini_video_dir = os.path.join(os.path.dirname(video_path), 'miniature')
        mini_video_filename = os.path.basename(video_path) + '.mp4'
        mini_video_path = os.path.join(mini_video_dir, mini_video_filename)
        
        
        if os.path.exists(mini_video_path):
            print(f"✓ Miniatura já existe: {mini_video_filename}")
            
           
            clip = VideoFileClip(video_path)
            duration = clip.duration
            fps = clip.fps
            resolution = clip.size
            clip.close()
            
            return {
                "duration": duration,
                "fps": fps,
                "resolution": resolution,
                "mini_video_path": mini_video_path,
                "mini_video_url": f'/api/videos/miniature/{mini_video_filename}',
                'full_video_url': f'/api/videos/{os.path.basename(video_path)}'
            }
        
        
        print(f"⚙ Gerando miniatura: {mini_video_filename}")
        
        clip = VideoFileClip(video_path)
        duration = clip.duration
        fps = clip.fps
        resolution = clip.size
        
        mini_duration = min(5, duration)  
        mini_clip = clip.subclipped(0, mini_duration)
        mini_video_fps = 2 

       
        if not os.path.exists(mini_video_dir):
            os.makedirs(mini_video_dir)

        mini_clip.write_videofile(
            mini_video_path, 
            codec='libx264', 
            audio=False, 
            fps=mini_video_fps,
            logger=None  
        )

        clip.close()
        mini_clip.close()

        return {
            "duration": duration,
            "fps": fps,
            "resolution": resolution,
            "mini_video_path": mini_video_path,
            "mini_video_url": f'/api/videos/miniature/{mini_video_filename}',
            'full_video_url': f'/api/videos/{os.path.basename(video_path)}'
        }
        
    except Exception as e:
        print(f"Erro ao processar vídeo: {e}")
        return None


def transform_into_frames(video_path, output_dir, frame_rate=10): #A cada 10 frames, extrai uma imagem
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        else:
            existing_files = os.listdir(output_dir)
            if existing_files:
                print(f"Frames já extraídos em: {output_dir}")
                return True
        
        clip = VideoFileClip(video_path)
        duration = clip.duration

        for t in range(0, int(duration), frame_rate):
            frame = clip.get_frame(t)
            if t // 3 == 0: #pega a camera direita
                frame = int(frame[:, frame.shape[1]//2:])
            else: #pega a camera esquerda
                frame = int(frame[:, :frame.shape[1]//2])

            frame_filename = os.path.join(output_dir, f"frame_{t:04d}.jpg")
            img = Image.fromarray(frame)
            img.save(frame_filename)

        clip.close()
        print(f"Frames extraídos para: {output_dir}")
        return True

    except Exception as e:
        print(f"Erro ao extrair frames: {e}")
        return False





if __name__ == "__main__":
    # get_minivideo('/home/joaorrafa/Documents/von_braun/interface_maquinaVC/videos/2025-10-21-223950.webm')
    file_path = '/home/joaorrafa/Documents/von_braun/interface_maquinaVC/videos/2025-10-21-223950.webm'
    print(os.path.basename(file_path))
    print(os.path.dirname(file_path))
    print(os.path.splitext(file_path))

    get_minivideo(file_path)
