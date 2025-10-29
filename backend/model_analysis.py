from ultralytics import YOLO
import torch
import os
import cv2

def load_model(model_name='yolov8n.pt'):
    model_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'models', model_name)
    # Tenta usar o arquivo local; se não existir, usa o nome do modelo para baixar automaticamente
    model_source = model_path if os.path.exists(model_path) else model_name
    # Cria o modelo e define dispositivo de inferência compatível com várias versões do Ultralytics
    device = 0 if torch.cuda.is_available() else 'cpu'
    model = YOLO(model_source)
    # Armazena o device para uso nas chamadas de inferência
    try:
        setattr(model, 'inference_device', device)
    except Exception:
        pass
    return model



def infer_image(model, image_path):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Imagem não encontrada: {image_path}")
    
    img = cv2.imread(image_path)
    results = model(img)
    detections = results[0].boxes.data.tolist()  
    # print('Detections raw:', detections)
    
    detections_final = {}
    formatted_detections = []
    img_height, img_width = img.shape[:2]

    for det in detections:
        print('Processing detection:', det)
        x1, y1, x2, y2, conf, cls = det

        #Normalizar as coordenadas
        x1 /= img_width
        y1 /= img_height
        x2 /= img_width
        y2 /= img_height

        formatted_detections.append({
            "bbox": [x1, y1, x2, y2],
            "confidence": conf,
            "class_id": int(cls),
            "class_name": model.names[int(cls)]
        })
    detections_final['detections'] = formatted_detections
    detections_final['img_shape'] = (img_height, img_width)
    detections_final['img_path'] = image_path
    return detections_final



import os

def save_results_as_yolo_masks(masks, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    

