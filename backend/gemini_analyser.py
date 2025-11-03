import json
import os
import base64
import re
import logging
import ast
from io import BytesIO
from flask import jsonify
from PIL import Image, ImageDraw, ImageFont

# Configure logger
logger = logging.getLogger(__name__)

def get_model_classes():
    """Load YOLO classes from classes.txt"""
    classes_path = os.path.join(os.path.dirname(__file__), 'models', 'classes.txt')
    if not os.path.exists(classes_path):
        logger.error(f"Classes file not found: {classes_path}")
        return {}
    
    try:
        with open(classes_path, 'r', encoding='utf-8') as f:
            raw = f.read().strip()
        classes_dict = ast.literal_eval(raw)
        return classes_dict
    except Exception as e:
        logger.error(f"Error loading classes: {e}")
        return {}

def analyze_image_gemini(request):
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400

        # Load available classes for detection
        available_classes = get_model_classes()
        class_names = list(available_classes.values())
        
        structured_suffix = (
            "\n\nFormato de resposta obrigatório:"
            "\n1) Primeiro, descreva brevemente o que você vê na imagem."
            "\n2) Em seguida, um bloco de código JSON contendo um array com detecções de objetos no formato:"
            "\n```json"
            "\n["
            "\n  {"
            "\n    \"bbox\": [x1, y1, x2, y2],"
            "\n    \"confidence\": 0.95,"
            "\n    \"class_name\": \"nome_da_classe\""
            "\n  }"
            "\n]"
            "\n```"
            "\nOnde:"
            "\n- bbox são coordenadas do bounding box [x1, y1, x2, y2] normalizadas entre 0 e 1"
            "\n- x1, y1 = canto superior esquerdo; x2, y2 = canto inferior direito"
            "\n- confidence é um valor entre 0 e 1 indicando a confiança da detecção"
            f"\n- class_name deve ser uma das seguintes classes: {', '.join(class_names[:20])}..."
            "\n- Se não houver objetos, retorne um array vazio []"
            "\n- Use apenas o formato JSON mostrado acima"
            "\n- Não adicione comentários ou texto extra dentro do JSON"
        )
        prompt = structured_suffix
        # Decode base64 image
        image_input = data['image']
        if image_input.startswith('data:image/'):
            base64_data = image_input.split(',')[1]
        else:
            base64_data = image_input

        image_bytes = base64.b64decode(base64_data)

        # Gemini API
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return jsonify({'error': 'GEMINI_API_KEY not configured'}), 500

        try:
            from google import genai
            from google.genai import types
        except Exception as e:
            logger.error(f"google-genai import error: {e}")
            return jsonify({'error': 'Gemini client not available'}), 500

        MODEL_ID = "gemini-robotics-er-1.5-preview"
        client = genai.Client(api_key=api_key)

        image_part = types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg')
        contents = [image_part]
        if prompt:
            contents.append(prompt)

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.5,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        print('\nGemini response:', response)
        text = getattr(response, 'text', '') or ''

        # Helper: extract first fenced JSON block (```json ... ```) and remove it from text.
        def extract_json_array_and_clean_text(s: str):
            ss = s.strip()
            arr = None
            clean = ss
            # 1) Prefer fenced code blocks with or without 'json'
            try:
                pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
                # Find first valid JSON array inside any fenced block
                for m in re.finditer(pattern, ss, flags=re.IGNORECASE):
                    code = m.group(1).strip()
                    try:
                        parsed = json.loads(code)
                        if isinstance(parsed, list) and arr is None:
                            arr = parsed
                    except Exception:
                        continue
                # Remove all fenced blocks from the clean text
                clean = re.sub(pattern, '', ss, flags=re.IGNORECASE).strip()
                if arr is not None:
                    return arr, clean
            except Exception:
                pass

            # 2) Fallback: find the first [ ... ] array anywhere in the text
            start = ss.find('[')
            end = ss.rfind(']')
            if start != -1 and end != -1 and end > start:
                candidate = ss[start:end + 1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, list):
                        arr = parsed
                        clean = (ss[:start] + ss[end + 1:]).strip()
                except Exception:
                    pass
            return arr, clean

        objects, clean_text = extract_json_array_and_clean_text(text)

        # Convert Gemini detections to YOLO format
        available_classes = get_model_classes()
        class_name_to_id = {v: k for k, v in available_classes.items()}
        
        detections_final = {}
        formatted_detections = []
        
        if isinstance(objects, list) and len(objects) > 0:
            for item in objects:
                try:
                    if not isinstance(item, dict):
                        continue
                        
                    bbox = item.get('bbox', [])
                    confidence = item.get('confidence', 0.8)
                    class_name = item.get('class_name', '')
                    
                    # Validate bbox format [x1, y1, x2, y2]
                    if (isinstance(bbox, (list, tuple)) and len(bbox) == 4 and
                        all(isinstance(coord, (int, float)) for coord in bbox)):
                        
                        x1, y1, x2, y2 = bbox
                        
                        # Ensure coordinates are in valid range [0, 1]
                        x1 = max(0, min(1, float(x1)))
                        y1 = max(0, min(1, float(y1)))
                        x2 = max(0, min(1, float(x2)))
                        y2 = max(0, min(1, float(y2)))
                        
                        # Ensure x2 > x1 and y2 > y1
                        if x2 <= x1 or y2 <= y1:
                            continue
                        
                        # Get class_id from class_name
                        class_id = class_name_to_id.get(class_name, 0)
                        
                        formatted_detections.append({
                            "bbox": [x1, y1, x2, y2],
                            "confidence": float(confidence),
                            "class_id": int(class_id),
                            "class_name": class_name
                        })
                        
                except Exception as e:
                    logger.error(f"Error processing detection: {e}")
                    continue
        
        # Get image dimensions for the response
        try:
            img = Image.open(BytesIO(image_bytes))
            img_height, img_width = img.size[1], img.size[0]
        except Exception:
            img_height, img_width = 0, 0
        
        detections_final['detections'] = formatted_detections
        detections_final['img_shape'] = (img_height, img_width)
        detections_final['img_path'] = 'gemini_analysis'
        
        # Return in the same format as YOLO model
        return jsonify(detections_final)
    except Exception as e:
        logger.error(f"Gemini analyze error: {e}")
        return jsonify({'error': 'Gemini analysis failed'}), 500