from ultralytics import YOLO
import cv2

# COCO class ids: person=0, bicycle=1, car=2, motorcycle=3, bus=5, truck=7
VEHICLE_CLASSES = {0, 1, 2, 3, 5, 7}

# Initialize YOLOv8 model (nano model: fast, auto-downloads on first run)
model = YOLO("yolov8n.pt")

def detect_and_track(frame):
    """
    Runs detection + tracking on a single frame using YOLOv8 and ByteTrack.
    Returns list of dicts: [{id, cls, bbox: (x1,y1,x2,y2), conf, lane}, ...]
    """
    height, width = frame.shape[:2]
    
    results = model.track(
        frame,
        persist=True,          # keep track IDs across frames
        classes=list(VEHICLE_CLASSES),
        tracker="bytetrack.yaml",
        conf=0.2,              # higher sensitivity for screen/photo detections
        verbose=False
    )

    vehicles = []
    if len(results) > 0 and results[0].boxes is not None:
        boxes = results[0].boxes.xyxy.cpu().numpy()
        clss = results[0].boxes.cls.cpu().numpy().astype(int)
        confs = results[0].boxes.conf.cpu().numpy()

        # Fallback to -1 if tracking ID is not assigned (e.g. static detections/still photo)
        if results[0].boxes.id is not None:
            ids = results[0].boxes.id.cpu().numpy().astype(int)
        else:
            ids = [-1] * len(boxes)

        for box, tid, cls, conf in zip(boxes, ids, clss, confs):
            x1, y1, x2, y2 = box.astype(int)
            lane = "north"
                
            vehicles.append({
                "id": int(tid),
                "cls": int(cls),
                "bbox": (x1, y1, x2, y2),
                "conf": float(conf),
                "lane": lane
            })
    return vehicles
