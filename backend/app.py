from flask import Flask, render_template, send_from_directory, Response
import os
from video_func import get_minivideo, transform_into_frames
from flask_cors import CORS
from model_analysis import load_model, infer_image
import mimetypes
import ast

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
            print(f"Usando cache para: {video}")
            videos.append(video_cache[cache_key])
        else:
            print(f"Processando vídeo: {video}")
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
    
    mime_type, _ = mimetypes.guess_type(file_path)
    response = send_from_directory(miniature_dir, filename)
    response.headers['Content-Type'] = mime_type or 'video/mp4'
    response.headers['Accept-Ranges'] = 'bytes'
    return response

@app.route('/api/videos/<filename>')
def serve_full_video(filename):
    video_dir = VIDEO_DIR
    
    
    file_path = os.path.join(video_dir, filename)
    if not os.path.exists(file_path):
        return {"error": "Vídeo não encontrado"}, 404
    
    mime_type, _ = mimetypes.guess_type(file_path)
    response = send_from_directory(video_dir, filename)
    response.headers['Content-Type'] = mime_type or 'video/mp4'
    response.headers['Accept-Ranges'] = 'bytes'
    return response

@app.route('/api/dataset/images/<video>/<image_filename>')
def serve_dataset_image(video, image_filename):
    # Serve frames extracted from videos for visualization/labeling
    images_dir = os.path.join(DATA_SET_DIR, video, 'images')
    file_path = os.path.join(images_dir, image_filename)
    if not os.path.exists(file_path):
        return {"error": "Imagem não encontrada"}, 404
    response = send_from_directory(images_dir, image_filename)
    response.headers['Content-Type'] = 'image/jpeg'
    return response

@app.route('/api/dataset/transform_video/<video_filename>')
def transform_video_endpoint(video_filename):
    video_path = os.path.join(VIDEO_DIR, video_filename)
    if not os.path.exists(video_path):
        return {"error": "Vídeo não encontrado"}, 404
    output_dir = os.path.join(DATA_SET_DIR, video_filename, 'images')
    frames_dir = transform_into_frames(video_path, output_dir=output_dir)
    if not frames_dir:
        return {"error": "Falha ao transformar vídeo em frames"}, 500

    return {"status": "ok", "frames_directory": frames_dir}

@app.route('/api/clear_cache', methods=['POST'])
def clear_cache():
    global video_cache
    video_cache = {}
    return {"status": "ok", "message": "Cache limpo com sucesso"}

@app.route('/api/analyse_image/<filename>/<framename>')
def analyse_image(filename, framename):
    image_path = os.path.join(DATA_SET_DIR, filename, 'images', framename)
    if not os.path.exists(image_path):
        return {"error": "Imagem não encontrada"}, 404

    model = load_model()
    results = infer_image(model, image_path)
    print('Results:', results)

    return {"status": "ok", "result":results}

@app.route('/api/dataset/videos')
def list_dataset_videos():
    if not os.path.exists(DATA_SET_DIR):
        return {"status": "ok", "datasets": []}
    
    datasets = [d for d in os.listdir(DATA_SET_DIR) if os.path.isdir(os.path.join(DATA_SET_DIR, d))]
    return {"status": "ok", "datasets": datasets}

@app.route('/api/dataset/videos/<video_name>')
def get_dataset_video_frames(video_name):
    video_dataset_dir = os.path.join(DATA_SET_DIR, video_name, 'images')
    if not os.path.exists(video_dataset_dir):
        return {"error": "Dataset de vídeo não encontrado"}, 404
        
    frames = [f for f in os.listdir(video_dataset_dir) if os.path.isfile(os.path.join(video_dataset_dir, f))]
    return {"status": "ok", "frames": frames}


@app.route('/api/analyse_image/get_classes')
def get_classes():
    try:
        file_path = os.path.join(os.path.dirname(__file__), 'models', 'classes.txt')
        with open(file_path, 'r', encoding='utf-8') as f:
            raw = f.read().strip()

        if not raw:
            return {"status": "ok", "classes": []}

        try:
            parsed = ast.literal_eval(raw)
        except Exception:
            parsed = None

        if isinstance(parsed, dict):
            classes = [str(name) for _, name in sorted(parsed.items(), key=lambda item: item[0])]
        elif isinstance(parsed, (list, tuple)):
            classes = [str(name) for name in parsed]
        else:
            cleaned = []
            for line in raw.splitlines():
                line = line.strip()
                if not line:
                    continue
                if ':' in line:
                    line = line.split(':', 1)[1].strip()
                line = line.strip(',').strip("\"'")
                if line:
                    cleaned.append(line)
            classes = cleaned

        preview = classes[:5]
        print('Classes carregadas:', preview, '...' if len(classes) > 5 else '')
        return {"status": "ok", "classes": classes}
    except Exception as exc:
        print('Erro ao carregar classes:', exc)
        return {"status": "error", "error": str(exc)}, 500

if __name__ == '__main__':
    app.run(debug = True,host='0.0.0.0', port=5000)