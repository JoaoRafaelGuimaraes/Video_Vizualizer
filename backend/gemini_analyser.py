import json
import os
import base64
import re
import logging
import ast
from io import BytesIO
from flask import jsonify
from PIL import Image, ImageDraw, ImageFont
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()  
# Configuração do Gemini
API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)
MODEL_ID = 'gemini-robotics-er-1.5-preview'


# Configurar logger
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

def analyze_image_gemini(image_path):

    with open(image_path, 'rb') as f:
        image_bytes = f.read()

    prompt = f"""
    Send me a list of objects detected in the image as bounding boxes formatted as JSON. THe bounding box should cover the entire object. Each object should have the following attributes:

    {{
        "bbox": "[x1, y1, x2, y2]",
        "class_id": int(cls),
        "class_name": CLASSNAME
    }}

    Search only for objects present in this list: {list(get_model_classes())[:20]}
    The bounding box coordinates (bbox) should be normalized between 0 and 1000, relative to the image dimensions.
    """
    image_response = client.models.generate_content(
        model=MODEL_ID,
        contents=[
            types.Part.from_bytes(
                data=image_bytes,
                mime_type='image/jpeg',
            ),
            prompt
        ],
        config = types.GenerateContentConfig(
            temperature=0.5,
            thinking_config=types.ThinkingConfig(thinking_budget=0)
        )
    )

    json_string = image_response.text.strip('```json\n').strip('\n```')
    points_data = json.loads(json_string)
    print('Response Text:', json_string)

    detections_final = {}
    formatted_detections = []
    for item in points_data:
        formatted_detections.append({
            "bbox": item['bbox'],
            "class_id": item['class_id'],
            "class_name": item['class_name']
        })
    detections_final['detections'] = formatted_detections
    # detections_final['img_shape'] = (img_height, img_width)
    detections_final['img_path'] = image_path
    print('Detections:', detections_final)
    return detections_final


if __name__ == "__main__":
    test_image_path = "/home/usuarios/joao.guimaraes/Video_Analyser/Video_Vizualizer/DATASET/videoTrem0046.mp4/images/frame_0000.jpg"
    analyze_image_gemini(test_image_path)