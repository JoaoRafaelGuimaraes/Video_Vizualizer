from flask import Flask, render_template, send_from_directory, Response
import os
from video_func import get_minivideo, transform_into_frames
from flask_cors import CORS
from model_analysis import load_model, infer_batch, save_results_as_mask

app = Flask(__name__)
CORS(app)

VIDEO_DIR = os.path.join(os.path.abspath(os.path.dirname(__file__)), '..', 'videos')
DATA_SET_DIR = os.path.join(os.path.abspath(os.path.dirname(__file__)), '..', 'DATASET')

video_cache = {}


@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/test')
def api_test():
    return {"status": "ok", "message": "API funcionando!"}


@app.route('/api/get_mini_video')
def get_mini_video():
    video_dir = VIDEO_DIR
    videos = []
    
    for video in os.listdir(video_dir):
        
        if video == 'miniature' or video.startswith('.'):
            continue
            
        video_path = os.path.join(video_dir, video)
        
        
        if not os.path.isfile(video_path):
            continue
        
        # Verifica se o vídeo já está em cache
        video_mtime = os.path.getmtime(video_path)
        cache_key = f"{video}_{video_mtime}"
        
        if cache_key in video_cache:
            print(f"✓ Usando cache para: {video}")
            videos.append(video_cache[cache_key])
        else:
            print(f"⚙ Processando vídeo: {video}")
            results = get_minivideo(video_path)
            if results:
                print(f"📊 Resultado: duration={results.get('duration')}, fps={results.get('fps')}, resolution={results.get('resolution')}")
                video_cache[cache_key] = results
                videos.append(results)

    print(f"📹 Total de vídeos retornados: {len(videos)}")
    return {"status": "ok", "mini_videos": videos}


@app.route('/api/videos/miniature/<filename>')
def serve_miniature_video(filename):
    miniature_dir = os.path.join(VIDEO_DIR, 'miniature')
    
    # Verifica se o arquivo existe
    file_path = os.path.join(miniature_dir, filename)
    if not os.path.exists(file_path):
        return {"error": "Vídeo não encontrado"}, 404
    
    response = send_from_directory(miniature_dir, filename)
    response.headers['Content-Type'] = 'video/mp4'
    response.headers['Accept-Ranges'] = 'bytes'
    return response

@app.route('/api/videos/<filename>')
def serve_full_video(filename):
    video_dir = VIDEO_DIR
    
    
    file_path = os.path.join(video_dir, filename)
    if not os.path.exists(file_path):
        return {"error": "Vídeo não encontrado"}, 404
    
    
    response = send_from_directory(video_dir, filename)
    response.headers['Content-Type'] = 'video/mp4'
    response.headers['Accept-Ranges'] = 'bytes'
    return response

@app.route('/api/clear_cache', methods=['POST'])
def clear_cache():
    global video_cache
    video_cache = {}
    return {"status": "ok", "message": "Cache limpo com sucesso"}


@app.route('/api/analyse_video/<filename>')
def analyse_video(filename): #Deve inferir o vídeo com YOLO, salvando as máscaras para treinamento de futuro modelo
    video_path = os.path.join(VIDEO_DIR, filename)
    if not os.path.exists(video_path):
        return {"error": "Vídeo não encontrado"}, 404
    image_dir = os.path.join(DATA_SET_DIR, 'frames', filename,'images')
    mask_dir= os.path.join(DATA_SET_DIR, 'frames', filename,'masks')
    os.makedirs(image_dir, exist_ok=True)
    os.makedirs(mask_dir, exist_ok=True)
    transform_into_frames(video_path=video_path, output_dir=image_dir)
    model = load_model()
    results = infer_batch(model,image_paths=image_dir)
    save_results_as_mask(results,output_dir=mask_dir)

    output_dir = os.path.join(DATA_SET_DIR, 'frames', filename)
    return {"status": "ok", "result_dir": output_dir}

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)