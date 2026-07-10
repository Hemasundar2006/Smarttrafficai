import easyocr
import cv2
import re

# Initialize EasyOCR Reader. Will download model files on first run.
# Set gpu=True if you have CUDA available.
reader = None

PLATE_PATTERN = re.compile(r"[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{3,4}")  # Loose Indian license plate pattern

def get_reader():
    global reader
    if reader is None:
        print("Initializing EasyOCR reader (this may take a few seconds)...")
        reader = easyocr.Reader(["en"], gpu=False)
    return reader

def preprocess_for_ocr(crop):
    """
    Advanced preprocessing for webcam captures (phones/printed plates).
    Applies Grayscale -> Upscale -> CLAHE -> Bilateral Filter.
    """
    # 1. Grayscale
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    
    # 2. Upscale (2x) using high-quality interpolation to give AI more pixels
    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    # 3. Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to defeat glare
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    gray = clahe.apply(gray)
    
    # 4. Bilateral filter to smooth noise but preserve sharp text edges
    gray = cv2.bilateralFilter(gray, 11, 17, 17)
    
    return gray

def run_ocr_on_crop(crop):
    """
    Runs multi-pass EasyOCR on both original grayscale and heavily preprocessed variants.
    """
    try:
        ocr_reader = get_reader()
        candidates = []
        
        # Variant 1: Basic grayscale (in case the raw image is already perfect)
        gray_basic = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        
        # Variant 2: Advanced OpenCV Preprocessing pipeline
        gray_advanced = preprocess_for_ocr(crop)
        
        # Run EasyOCR on both variants to maximize chances of catching hard-to-read text
        for img_variant in [gray_basic, gray_advanced]:
            results = ocr_reader.readtext(img_variant, mag_ratio=2.0, contrast_ths=0.1, adjust_contrast=True)
            
            for bbox_ocr, text, conf in results:
                clean_text = text.upper().replace(" ", "").strip()
                # Retain only alphanumeric characters
                clean_text = re.sub(r'[^A-Z0-9]', '', clean_text)
                # Accept any candidate with conf > 0.1 and length >= 2
                if conf > 0.1 and len(clean_text) >= 2:
                    candidates.append((clean_text, conf))
                    
        return candidates
    except Exception as e:
        print(f"Error in run_ocr_on_crop: {e}")
        return []

def read_plate(frame, bbox):
    """
    Crops the bumper region of the vehicle (lower 40% height) and performs OCR.
    If no text is detected, falls back to scanning the entire vehicle box
    to ensure hand-held plates (e.g. held up to webcam) are captured.
    """
    x1, y1, x2, y2 = bbox
    h, w = frame.shape[:2]
    
    # Bounding box safety boundaries
    x1, y1, x2, y2 = max(0, x1), max(0, y1), min(w, x2), min(h, y2)
    
    # 1. Try Bumper Crop (Lower 40% of the box)
    box_h = y2 - y1
    y1_plate = int(y2 - box_h * 0.4)
    
    crop = frame[max(0, y1_plate):y2, x1:x2]
    candidates = []
    
    if crop.size > 0:
        candidates = run_ocr_on_crop(crop)
        
    # 2. Fallback to Full Bounding Box Crop (if tight crop yielded no text)
    if not candidates:
        full_crop = frame[y1:y2, x1:x2]
        if full_crop.size > 0:
            print("[OCR Fallback] Running OCR on full bounding box crop...")
            candidates = run_ocr_on_crop(full_crop)
            
    # Sort candidates by confidence
    candidates = sorted(candidates, key=lambda x: x[1], reverse=True)
    print(f"[OCR Candidates for Bbox {bbox}] {candidates}")
    
    # Check if any candidate matches the Indian plate pattern
    for c, conf in candidates:
        if PLATE_PATTERN.search(c):
            return PLATE_PATTERN.search(c).group()
    
    # Fallback to the highest confidence alphanumeric candidate
    return candidates[0][0] if candidates else None
