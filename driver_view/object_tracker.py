import cv2
import numpy as np
from ultralytics import YOLO
from filterpy.kalman import KalmanFilter
from collections import defaultdict
import threading
import queue
import time

class ObjectTracker:
    def __init__(self, track_id):
        self.track_id = track_id
        self.kalman = KalmanFilter(dim_x=8, dim_z=4)
        self.setup_kalman()
        self.history = []
        self.last_update = time.time()
        
    def setup_kalman(self):
        # Estado: [x, y, w, h, vx, vy, vw, vh]
        self.kalman.x = np.zeros(8)
        self.kalman.F = np.array([
            [1, 0, 0, 0, 1, 0, 0, 0],
            [0, 1, 0, 0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0, 0, 1, 0],
            [0, 0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 1]
        ])
        self.kalman.H = np.array([
            [1, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0]
        ])
        self.kalman.P *= 1000
        self.kalman.R *= 10
        self.kalman.Q *= 0.1

class VideoProcessor:
    def __init__(self, model_path, polygon_points=None):
        self.model = YOLO(model_path)
        self.trackers = {}
        self.next_id = 0
        self.polygon_points = polygon_points
        self.frame_queue = queue.Queue(maxsize=30)
        self.result_queue = queue.Queue(maxsize=30)
        self.processing = False
        
    def start_processing(self, video_source):
        self.processing = True
        # Thread para captura de frames
        capture_thread = threading.Thread(target=self._capture_frames, args=(video_source,))
        # Thread para processamento
        process_thread = threading.Thread(target=self._process_frames)
        
        capture_thread.start()
        process_thread.start()
        
    def _capture_frames(self, video_source):
        cap = cv2.VideoCapture(video_source)
        frame_count = 0
        
        while self.processing:
            ret, frame = cap.read()
            if not ret:
                break
                
            # Processa a cada 2-3 frames para melhor performance
            if frame_count % 2 == 0:
                if not self.frame_queue.full():
                    self.frame_queue.put((frame_count, frame))
                    
            frame_count += 1
            time.sleep(0.033)  # ~30 FPS
            
        cap.release()
        
    def _process_frames(self):
        while self.processing:
            try:
                frame_id, frame = self.frame_queue.get(timeout=1)
                result = self._process_single_frame(frame, frame_id)
                
                if not self.result_queue.full():
                    self.result_queue.put(result)
                    
            except queue.Empty:
                continue
                
    def _process_single_frame(self, frame, frame_id):
        # YOLO inference
        results = self.model(frame)
        detections = results[0].boxes.data.cpu().numpy()
        
        # Update trackers
        tracked_objects = self._update_trackers(detections)
        
        # Check polygon intersections
        polygon_alerts = []
        if self.polygon_points:
            for obj in tracked_objects:
                bbox = obj['bbox']
                if object_in_polygon(bbox, self.polygon_points):
                    polygon_alerts.append(obj)
        
        return {
            'frame_id': frame_id,
            'frame': frame,
            'tracked_objects': tracked_objects,
            'polygon_alerts': polygon_alerts,
            'timestamp': time.time()
        }
        
    def _update_trackers(self, detections):
        # Implementar associação de detecções com trackers existentes
        # usando distância euclidiana ou IoU
        current_time = time.time()
        
        # Predict all trackers
        for tracker in self.trackers.values():
            tracker.kalman.predict()
            
        # Associate detections with trackers
        tracked_objects = []
        for det in detections:
            x1, y1, x2, y2, conf, cls = det[:6]
            bbox = [x1, y1, x2, y2]
            
            # Find best matching tracker
            best_tracker = self._find_best_tracker(bbox)
            
            if best_tracker:
                # Update existing tracker
                measurement = np.array([x1, y1, x2-x1, y2-y1])
                best_tracker.kalman.update(measurement)
                best_tracker.last_update = current_time
            else:
                # Create new tracker
                tracker = ObjectTracker(self.next_id)
                tracker.kalman.x[:4] = [x1, y1, x2-x1, y2-y1]
                self.trackers[self.next_id] = tracker
                self.next_id += 1
                best_tracker = tracker
                
            tracked_objects.append({
                'track_id': best_tracker.track_id,
                'bbox': bbox,
                'confidence': conf,
                'class_id': int(cls),
                'class_name': self.model.names[int(cls)]
            })
            
        # Remove old trackers
        self._cleanup_trackers(current_time)
        
        return tracked_objects