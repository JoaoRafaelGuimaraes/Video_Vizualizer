from flask import Flask, render_template, send_from_directory, Response
import os
from video_func import get_minivideo, transform_into_frames
from flask_cors import CORS
from model_analysis import load_model, infer_batch, return_results_as_mask, save_results_as_yolo_masks

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

@app.route('/api/clear_cache', methods=['POST'])
def clear_cache():
    global video_cache
    video_cache = {}
    return {"status": "ok", "message": "Cache limpo com sucesso"}


@app.route('/api/analyse_video/<filename>')
def analyse_video(filename): # Deve inferir o vídeo com YOLO, salvando as máscaras para treinamento de futuro modelo
    video_path = os.path.join(VIDEO_DIR, filename)
    if not os.path.exists(video_path):
        return {"error": "Vídeo não encontrado"}, 404
    image_dir = os.path.join(DATA_SET_DIR, filename,'images')
    mask_dir= os.path.join(DATA_SET_DIR, filename,'masks')
    os.makedirs(image_dir, exist_ok=True)
    os.makedirs(mask_dir, exist_ok=True)
    transform_into_frames(video_path=video_path, output_dir=image_dir)
    
    model = load_model()
    # Usa padrão glob para pegar apenas imagens extraídas
    results = infer_batch(model,image_paths=os.path.join(image_dir, '*.jpg'))
    formatted = return_results_as_mask(results,model)
    # Opcional: salvar máscaras/labels em formato YOLO se disponíveis
    try:
        save_results_as_yolo_masks(formatted,output_dir=mask_dir)
    except Exception as e:
        # Evita quebrar o fluxo caso o formato de máscara não esteja presente
        print(f"Aviso: não foi possível salvar máscaras YOLO - {e}")

    output_dir = os.path.join(DATA_SET_DIR, filename)
    # Prepara frames para visualização no front-end (com URLs servíveis e detecções normalizadas)
    frames = []
    for item in formatted:
        img_path = item.get('image_path')
        if not img_path:
            continue
        base = os.path.splitext(os.path.basename(img_path))[0]
        image_filename = f"{base}.jpg"
        image_url = f"/api/dataset/images/{filename}/{image_filename}"
        frames.append({
            "image_name": image_filename,
            "image_url": image_url,
            "detections": item.get('detections', [])
        })

    return {"status": "ok", "result_dir": output_dir, "frames": frames}


@app.route('/api/retrieve_masks/<filename>')
def retrieve_masks(filename):
    mask_dir = os.path.join(DATA_SET_DIR, filename,'masks')
    
    if not os.path.exists(mask_dir):
        return {"error": "Diretório de máscaras não encontrado"}, 404
    
    masks = []
    for mask_file in os.listdir(mask_dir):
        if mask_file.startswith('.'):
            continue
        masks.append(f'/api/masks/{filename}/{mask_file}')
    
    return {"status": "ok", "masks": masks}
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)