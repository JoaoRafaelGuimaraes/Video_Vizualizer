from ultralytics import YOLO
import torch
import os
import cv2
import ast

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


def read_yolo_mask(mask_path):
    if not os.path.exists(mask_path):
        raise FileNotFoundError(f"Máscara não encontrada: {mask_path}")
    

    with open(mask_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    formatted_detections = []
    detections_final = {}
   
    for line in lines:
        parts = line.strip().split()
        if not parts:
            continue
        if len(parts) != 5:
            # expected format: class_id x_center y_center width height
            continue
        cls_id, x_c, y_c, w, h = map(float, parts)
        
        x1 = x_c - w / 2
        y1 = y_c - h / 2
        x2 = x_c + w / 2
        y2 = y_c + h / 2

        formatted_detections.append({
            "bbox": [x1, y1, x2, y2],
            "class_id": int(cls_id),
            "class_name": get_model_names().get(int(cls_id), 'unknown')
        })
    detections_final['detections'] = formatted_detections
    detections_final['mask_path'] = mask_path
    return detections_final

def save_yolo_mask(detections, save_path):
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, 'w', encoding='utf-8') as f:
        for det in detections.get('detections', []):
            bbox = det.get('bbox', [])
            if len(bbox) == 4:
                x1, y1, x2, y2 = bbox
                w = x2 - x1
                h = y2 - y1
                x_c = x1 + w / 2
                y_c = y1 + h / 2
                cls_id = det.get('class_id', 0)
                f.write(f"{cls_id} {x_c} {y_c} {w} {h}\n")


def get_model_names(classes_file='classes.txt'):
    classes_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'models', classes_file)
    if not os.path.exists(classes_path):
        print(f"Arquivo de classes não encontrado: {classes_path}")
        return []
    with open(classes_path, 'r', encoding='utf-8') as f:
        raw = f.read().strip()
    classes_dict = ast.literal_eval(raw)
    return classes_dict
    





if __name__ == '__main__':
    print('Iniciando')
    get_model_names()