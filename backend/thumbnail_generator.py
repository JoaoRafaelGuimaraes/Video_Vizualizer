"""
Gerador de thumbnails para vídeos
"""
import os
import sys

def check_opencv():
    """Verifica se o OpenCV está instalado"""
    try:
        import cv2
        return True
    except ImportError:
        return False

def install_opencv():
    """Instala opencv-python se não estiver disponível"""
    if not check_opencv():
        print("OpenCV não encontrado. Instalando...")
        import subprocess
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "opencv-python"])
            print("OpenCV instalado com sucesso!")
            return True
        except subprocess.CalledProcessError:
            print("Erro ao instalar OpenCV")
            return False
    return True

def generate_video_thumbnail_safe(video_path, output_path=None, timestamp=1.0, width=320):
    """
    Gera thumbnail de um vídeo de forma segura
    Fallback para PIL se OpenCV não estiver disponível
    """
    
    # Tentar com OpenCV primeiro
    if check_opencv():
        return generate_thumbnail_opencv(video_path, output_path, timestamp, width)
    
    # Fallback: tentar com FFmpeg se disponível
    return generate_thumbnail_ffmpeg(video_path, output_path, timestamp, width)

def generate_thumbnail_opencv(video_path, output_path=None, timestamp=1.0, width=320):
    """Gera thumbnail usando OpenCV"""
    try:
        import cv2
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Erro: Não foi possível abrir o vídeo {video_path}")
            return None
            
        # Obter informações do vídeo
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        if fps <= 0:
            fps = 30  # fallback
            
        # Calcular frame baseado no timestamp
        frame_number = min(int(timestamp * fps), total_frames - 1)
        frame_number = max(0, frame_number)
        
        # Ir para o frame desejado
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        
        ret, frame = cap.read()
        cap.release()
        
        if not ret or frame is None:
            print(f"Erro: Não foi possível ler o frame do vídeo {video_path}")
            return None
            
        # Redimensionar mantendo aspect ratio
        height, width_orig = frame.shape[:2]
        if width_orig > 0:
            target_height = int((width / width_orig) * height)
            resized = cv2.resize(frame, (width, target_height))
        else:
            resized = frame
        
        if output_path:
            success = cv2.imwrite(output_path, resized)
            if success:
                return output_path
            else:
                print(f"Erro ao salvar thumbnail em {output_path}")
                return None
        else:
            # Retornar como bytes
            success, buffer = cv2.imencode('.jpg', resized, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if success:
                return buffer.tobytes()
            else:
                return None
                
    except Exception as e:
        print(f"Erro ao gerar thumbnail com OpenCV: {e}")
        return None

def generate_thumbnail_ffmpeg(video_path, output_path=None, timestamp=1.0, width=320):
    """Gera thumbnail usando FFmpeg como fallback"""
    try:
        import subprocess
        import tempfile
        
        # Verificar se ffmpeg está disponível
        try:
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("FFmpeg não encontrado. Não é possível gerar thumbnail.")
            return None
        
        # Usar arquivo temporário se output_path não foi fornecido
        if not output_path:
            temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
            output_path = temp_file.name
            temp_file.close()
            cleanup_temp = True
        else:
            cleanup_temp = False
        
        # Comando FFmpeg para extrair frame
        cmd = [
            'ffmpeg', '-y',
            '-ss', str(timestamp),
            '-i', video_path,
            '-vframes', '1',
            '-vf', f'scale={width}:-1',
            '-q:v', '2',
            output_path
        ]
        
        # Executar comando
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0 and os.path.exists(output_path):
            if cleanup_temp:
                # Ler bytes e limpar arquivo temporário
                with open(output_path, 'rb') as f:
                    thumbnail_bytes = f.read()
                os.unlink(output_path)
                return thumbnail_bytes
            else:
                return output_path
        else:
            print(f"Erro FFmpeg: {result.stderr}")
            if cleanup_temp and os.path.exists(output_path):
                os.unlink(output_path)
            return None
            
    except Exception as e:
        print(f"Erro ao gerar thumbnail com FFmpeg: {e}")
        return None

def create_placeholder_thumbnail(width=320, height=180):
    """Cria um thumbnail placeholder quando não é possível gerar do vídeo"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        # Criar imagem com gradiente
        img = Image.new('RGB', (width, height), color='#2d3748')
        draw = ImageDraw.Draw(img)
        
        # Adicionar gradiente simples
        for y in range(height):
            color_value = int(45 + (y / height) * 20)  # Gradiente sutil
            draw.line([(0, y), (width, y)], fill=(color_value, color_value + 10, color_value + 20))
        
        # Adicionar ícone de vídeo no centro
        center_x, center_y = width // 2, height // 2
        icon_size = min(width, height) // 4
        
        # Desenhar triângulo (play button)
        triangle_points = [
            (center_x - icon_size//2, center_y - icon_size//2),
            (center_x - icon_size//2, center_y + icon_size//2),
            (center_x + icon_size//2, center_y)
        ]
        draw.polygon(triangle_points, fill='white')
        
        # Adicionar texto
        try:
            font = ImageFont.load_default()
            text = "Vídeo"
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            text_x = (width - text_width) // 2
            text_y = center_y + icon_size
            draw.text((text_x, text_y), text, fill='white', font=font)
        except:
            pass  # Se não conseguir carregar font, ignorar texto
        
        # Converter para bytes
        import io
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        return buffer.getvalue()
        
    except Exception as e:
        print(f"Erro ao criar placeholder: {e}")
        return None

# Inicialização automática
if __name__ == "__main__":
    install_opencv()