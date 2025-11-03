from flask import Flask, render_template, request, send_from_directory, Response
import os
import logging
from dotenv import load_dotenv
from video_func import get_minivideo, transform_into_frames
from flask_cors import CORS
from model_analysis import load_model, infer_image, read_yolo_mask, save_yolo_mask
from gemini_analyser import analyze_image_gemini
import mimetypes
import ast
import base64
from thumbnail_generator import generate_video_thumbnail_safe, create_placeholder_thumbnail

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

@app.route('/api/videos/thumbnail/<video_filename>')
def generate_thumbnail(video_filename):
    """Gera thumbnail dinâmico do primeiro frame do vídeo"""
    try:
        # Primeiro, tentar buscar thumbnail existente
        miniature_dir = os.path.join(VIDEO_DIR, 'miniature')
        thumbnail_name = video_filename.replace('.mp4', '.jpg')
        thumbnail_path = os.path.join(miniature_dir, thumbnail_name)
        
        # Se thumbnail existe, retornar ele
        if os.path.exists(thumbnail_path):
            return send_from_directory(miniature_dir, thumbnail_name)
        
        # Se não existe, gerar do vídeo original ou miniatura
        video_path_mini = os.path.join(miniature_dir, video_filename)
        video_path_full = os.path.join(VIDEO_DIR, video_filename)
        
        # Priorizar vídeo miniatura (menor, mais rápido)
        if os.path.exists(video_path_mini):
            thumbnail_bytes = generate_video_thumbnail_safe(video_path_mini)
        elif os.path.exists(video_path_full):
            thumbnail_bytes = generate_video_thumbnail_safe(video_path_full)
        else:
            return {"error": "Vídeo não encontrado"}, 404
            
        # Se falhou em gerar thumbnail, usar placeholder
        if thumbnail_bytes is None:
            print(f"Gerando placeholder para {video_filename}")
            thumbnail_bytes = create_placeholder_thumbnail()
            
        if thumbnail_bytes is None:
            return {"error": "Erro ao gerar thumbnail"}, 500
            
        # Salvar thumbnail para uso futuro
        os.makedirs(miniature_dir, exist_ok=True)
        with open(thumbnail_path, 'wb') as f:
            f.write(thumbnail_bytes)
        
        # Retornar thumbnail
        return Response(
            thumbnail_bytes,
            mimetype='image/jpeg',
            headers={
                'Cache-Control': 'public, max-age=86400',  # Cache por 24h
                'Content-Type': 'image/jpeg'
            }
        )
        
    except Exception as e:
        print(f"Erro ao processar thumbnail para {video_filename}: {e}")
        return {"error": "Erro interno do servidor"}, 500

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
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@app.route('/api/dataset/masks/<video>/<image_filename>/<action>', methods=['GET', 'POST'])
def handle_dataset_mask(video, image_filename, action):
    masks_dir = os.path.join(DATA_SET_DIR, video, 'masks')
    file_path = os.path.join(masks_dir, image_filename.split('.')[0] + '.txt')
    if action == 'read':
        if not os.path.exists(file_path):
            return {"error": "Máscara não encontrada"}, 404
        result = read_yolo_mask(file_path)
        return {'status': 'ok', 'result': result}
    elif action == 'save':
        data = request.get_json()
        if not data:
            return {"error": "Dados inválidos"}, 400
        save_yolo_mask(data, file_path)
        return {"status": "ok", "message": "Máscara salva com sucesso"}

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

@app.route('/api/analyse_image/<filename>/<framename>/<modelo>')
def analyse_image(filename, framename, modelo):
    
    image_path = os.path.join(DATA_SET_DIR, filename, 'images', framename)
    logger.info(f"Caminho da imagem: {image_path}")
    
    if not os.path.exists(image_path):
        logger.error(f"Imagem não encontrada: {image_path}")
        return {"error": "Imagem não encontrada"}, 404
    if modelo not in ['yolo', 'gemini']:
        logger.error(f"Modelo inválido: {modelo}")
        return {"error": "Modelo inválido"}, 400
    
    if modelo == 'yolo':
        logger.info("Executando análise YOLO")
        model = load_model()
        results = infer_image(model, image_path)
    elif modelo == 'gemini':
        results = analyze_image_gemini(image_path)
        logger.info("Análise Gemini concluída")
        
   
    return {"status": "ok", "result": results}

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