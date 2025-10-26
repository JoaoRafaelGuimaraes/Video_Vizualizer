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
    
    formatted_detections = []
    img_height, img_width = img.shape[:2]

    for det in detections:
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
    
    return formatted_detections


def infer_multiple(model, image_paths):
    all_detections = {}
    for image_path in image_paths:
        detections = infer_image(model, image_path)
        all_detections[os.path.basename(image_path)] = detections
    return all_detections

def infer_batch(model, image_paths):
    # image_paths pode ser lista de caminhos, diretório ou padrão glob
    device = getattr(model, 'inference_device', None)
    # Ultralytics aceita o parâmetro 'device' nas chamadas de inferência
    results = model(image_paths, batch=12, device=device)
    return results


def return_results_as_mask(results, model):
    formatted_detections = []

    for result in results:
        img_h, img_w = result.orig_img.shape[:2]
        detections = []
        for det in result.boxes.data.tolist():
            x1, y1, x2, y2, conf, cls = det
            # Normaliza as coordenadas
            x1 /= img_w
            y1 /= img_h
            x2 /= img_w
            y2 /= img_h

            # Converte para x_center, y_center, w, h (opcional para YOLO)
            xc = (x1 + x2) / 2
            yc = (y1 + y2) / 2
            w = x2 - x1
            h = y2 - y1
            detections.append({
                "bbox_xyxy": [x1, y1, x2, y2],
                "bbox_yolo": [xc, yc, w, h],
                "confidence": conf,
                "class_id": int(cls),
                "class_name": model.names[int(cls)]
            })
        formatted_detections.append({
            "image_path": result.path,
            "detections": detections
        })

    return formatted_detections

import os

def save_results_as_yolo_masks(masks, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    for item in masks:
        image_path = item['image_path']
        base = os.path.splitext(os.path.basename(image_path))[0]
        label_path = os.path.join(output_dir, f"{base}.txt")
        
        detections = item.get('detections', [])
        if not detections:
            continue  # skip empty detections
        
        # Assume que cada detecção possui: 'class_id', 'mask' (lista de pontos), 'image_shape'
        with open(label_path, "w") as f:
            for det in detections:
                if 'mask' not in det or det['mask'] is None or len(det['mask']) == 0:
                    continue
                img_h, img_w = det['image_shape']  # Tupla (h, w) por detecção
                seg_norm = []
                for x, y in det['mask']:
                    seg_norm += [x / img_w, y / img_h]
                f.write(f"{int(det['class_id'])} " + " ".join(map(str, seg_norm)) + "\n")

