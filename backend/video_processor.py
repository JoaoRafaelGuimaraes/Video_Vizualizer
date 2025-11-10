import cv2
import numpy as np
from ultralytics import YOLO
import time
import base64
from shapely.geometry import Point, Polygon

# Variável global para armazenar os pontos do polígono
# Em uma aplicação real, isso deve ser gerenciado de forma mais robusta (ex: por sessão)
polygon_points_global = []

def set_polygon_points(points):
    """Atualiza os pontos do polígono global."""
    global polygon_points_global
    # Converte pontos normalizados (0-1) para o formato que shapely espera
    polygon_points_global = [(p['x'], p['y']) for p in points]
    print(f"Polígono atualizado com {len(polygon_points_global)} pontos.")

def object_in_polygon(object_bbox, polygon_points, frame_shape):
    """Verifica se o centro de um objeto está dentro do polígono."""
    if not polygon_points or len(polygon_points) < 3:
        return False
    
    h, w = frame_shape[:2]
    
    # Converte os pontos do polígono de normalizado (0-1) para coordenadas de pixel
    polygon_pixel_points = [(p[0] * w, p[1] * h) for p in polygon_points]
    
    x1, y1, x2, y2 = object_bbox
    center_x = (x1 + x2) / 2
    center_y = (y1 + y2) / 2
    
    point = Point(center_x, center_y)
    polygon = Polygon(polygon_pixel_points)

    return polygon.contains(point)

class VideoProcessor:
    def __init__(self, model_path):
        self.model = YOLO(model_path)

    def generate_frames(self, video_source):
        """Gera frames de vídeo processados com detecções para stream MJPEG."""
        cap = cv2.VideoCapture(video_source)
        if not cap.isOpened():
            print(f"Erro: Não foi possível abrir o vídeo em {video_source}")
            return

        frame_count = 0
        while True:
            ret, frame = cap.read()
            frame = frame[:,:frame.shape[1] // 2]  # Corta o vídeo na metade
            if not ret:
                print("Fim do vídeo ou erro na leitura.")
                break

            # Processa a cada 2 frames para performance
            if frame_count % 2 != 0:
                frame_count += 1
                continue
            
            frame_count += 1

            # YOLO Inference
            results = self.model(frame, verbose=False)
            detections = results[0].boxes.data.cpu().numpy()
            
            alert = False
            
            # Desenha bounding boxes
            for det in detections:
                x1, y1, x2, y2, conf, cls = det[:6]
                class_name = self.model.names[int(cls)]
                label = f'{class_name} {conf:.2f}'
                
                # Verifica se o objeto está no polígono
                in_poly = object_in_polygon((x1, y1, x2, y2), polygon_points_global, frame.shape[:2])
                
                color = (0, 0, 255) if in_poly else (0, 255, 0) # Vermelho se no polígono, senão verde
                if in_poly:
                    alert = True

                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                cv2.putText(frame, label, (int(x1), int(y1) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            # Desenha o polígono de área de risco no frame
            if polygon_points_global and len(polygon_points_global) >= 3:
                h, w = frame.shape[:2]
                poly_pixels = np.array([(int(p[0] * w), int(p[1] * h)) for p in polygon_points_global], np.int32)
                poly_pixels = poly_pixels.reshape((-1, 1, 2))
                cv2.polylines(frame, [poly_pixels], isClosed=True, color=(255, 255, 0), thickness=3)
                # Preenche com transparência
                overlay = frame.copy()
                cv2.fillPoly(overlay, [poly_pixels], color=(255, 255, 0))
                cv2.addWeighted(overlay, 0.2, frame, 0.8, 0, frame)

            # Adiciona alerta no frame se necessário
            if alert:
                cv2.putText(frame, "OBJETO NA AREA DE RISCO!", (50, 50), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3, cv2.LINE_AA)

            # Codifica o frame para JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            if not ret:
                continue
            
            frame_bytes = buffer.tobytes()
            
            # Yield para o stream MJPEG
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            time.sleep(0.03) # Controla o FPS do stream

        cap.release()
        print("Stream finalizado.")
