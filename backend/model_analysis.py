from ultralytics import YOLO
from ultralytics.utils import TORCH
import os
import cv2

def load_model(model_name='yolov8n.pt'):
    model_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'models', model_name)
    # if not os.path.exists(model_path):
    #     raise FileNotFoundError(f"Modelo não encontrado: {model_path}")
    if (TORCH.cuda.is_available()):
        # print("✓ Usando GPU para inferência")
        model=YOLO(model_path, device=0)
    else:
        # print("✓ Usando CPU para inferência")
        model = YOLO(model_path)
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
    # image_paths é uma lista de caminhos de imagens, ou diretorio ou array de imagens
    results = model(image_paths, batch=12)
    return results


def save_results_as_mask(results,output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for i, result in enumerate(results):
        mask = result.masks.data.cpu().numpy()[0]  # Pega a máscara do primeiro objeto detectado
        mask = (mask * 255).astype('uint8')  # Converte para escala de cinza
        mask_filename = os.path.join(output_dir, f"mask_{i:04d}.png")
        cv2.imwrite(mask_filename, mask)