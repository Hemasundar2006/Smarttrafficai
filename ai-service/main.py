import cv2
import time
import os
import argparse
import requests
from datetime import datetime

from download_sample import download_video
from detector import detect_and_track
from signal_logic import SignalCycle
from violation import ViolationDetector
from plate_ocr import read_plate
from flask import Flask, Response
from flask_cors import CORS
import threading
import numpy as np

BACKEND_URL = os.environ.get("BACKEND_URL", "https://smart-traffic-backend-x5ke.onrender.com/api")
LANES = ["north", "south", "east", "west"]

# Initialize Flask App for MJPEG streaming
flask_app = Flask(__name__)
CORS(flask_app)

latest_frame = None
frame_lock = threading.Lock()

def generate_frames():
    global latest_frame
    while True:
        with frame_lock:
            if latest_frame is None:
                time.sleep(0.03)
                continue
            ret, buffer = cv2.imencode('.jpg', latest_frame)
            if not ret:
                continue
            frame_bytes = buffer.tobytes()
            
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.033) # limit to ~30 FPS

@flask_app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

def start_flask_server():
    port = int(os.environ.get("PORT", 5001))
    flask_app.run(host='0.0.0.0', port=port, threaded=True, debug=False, use_reloader=False)

def push_signal_state(state):
    try:
        requests.post(f"{BACKEND_URL}/signal", json=state, timeout=1)
    except requests.exceptions.RequestException:
        pass

def push_violation(payload, image_path):
    try:
        with open(image_path, "rb") as f:
            r = requests.post(
                f"{BACKEND_URL}/violations",
                data=payload,
                files={"image": f},
                timeout=3
            )
            print(f"[Uploaded Violation] Server Response: {r.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"Failed to push violation to backend: {e}")

current_backend_src = None

def config_poller():
    global current_backend_src
    while True:
        try:
            current_backend_src = fetch_camera_source()
        except Exception:
            pass
        time.sleep(5)

def run(video_source=0, headless=False):
    # Start background configuration poller
    threading.Thread(target=config_poller, daemon=True).start()

    # Ensure sample video exists
    if video_source == "sample_traffic.mp4" and not os.path.exists(video_source):
        download_video()
        if not os.path.exists(video_source):
            print("Warning: Sample video not found, falling back to camera index 0.")
            video_source = 0

    # Start Flask MJPEG streaming server in a separate background thread
    flask_thread = threading.Thread(target=start_flask_server, daemon=True)
    flask_thread.start()
    print("[Flask] Live streaming server started on http://localhost:5001/video_feed")

    # Initialize VideoCapture safely
    cap = cv2.VideoCapture(video_source)
    cap_opened = cap.isOpened()
    
    # Default dimensions
    width, height = 640, 480
    frame = None
    
    if cap_opened:
        ok, first_frame = cap.read()
        if ok:
            frame = first_frame
            height, width = frame.shape[:2]
            print(f"Video Resolution: {width}x{height}")
        else:
            print("Warning: Could not read first frame.")
            cap_opened = False
    else:
        print(f"Warning: Could not open video source {video_source}")

    # Set Stop Line dynamically at 70% of frame height
    stop_line_y = int(height * 0.7)
    stop_line = ((50, stop_line_y), (width - 50, stop_line_y))
    print(f"Configured stop line at y={stop_line_y}")

    cycle = SignalCycle(LANES)
    violation_detector = ViolationDetector(stop_line)

    last_sync_time = 0
    sync_interval = 1.0  # Sync with backend every 1 second

    # Create folder for saving violation images locally as backup
    os.makedirs("violation_crops", exist_ok=True)

    frame_count = 0
    try:
        while True:
            # Check if camera source was updated via backend config
            global current_backend_src
            if current_backend_src is not None:
                parsed_src = int(current_backend_src) if current_backend_src.isdigit() else current_backend_src
                if parsed_src != video_source:
                    print(f"[ConfigChange] Camera source updated from {video_source} to {parsed_src}. Re-initializing video capture...")
                    if cap is not None:
                        cap.release()
                    
                    if parsed_src == "sample_traffic.mp4" and not os.path.exists(parsed_src):
                        download_video()
                    
                    video_source = parsed_src
                    cap = cv2.VideoCapture(video_source)
                    cap_opened = cap.isOpened()
                    
                    if cap_opened:
                        ok, new_frame = cap.read()
                        if ok:
                            frame = new_frame
                            height, width = frame.shape[:2]
                            stop_line_y = int(height * 0.7)
                            stop_line = ((50, stop_line_y), (width - 50, stop_line_y))
                            violation_detector = ViolationDetector(stop_line)
                            frame_count = 0
                            print(f"Video Re-initialized successfully. Resolution: {width}x{height}")
                        else:
                            print(f"Error: Could not read frame from new source {video_source}")
                            cap_opened = False
                    else:
                        print(f"Error: Could not open new source {video_source}")
                        cap_opened = False

            # Read next frame if camera is open and working
            ok = False
            if cap_opened:
                if frame_count == 0 and frame is not None:
                    # We already read the first frame during initialization
                    ok = True
                else:
                    ok, frame = cap.read()
                
                if not ok:
                    print("End of video stream or failed to read frame.")
                    cap_opened = False
                frame_count += 1

            if not ok or frame is None:
                # Generate a placeholder black frame when camera is offline
                frame = np.zeros((height, width, 3), dtype=np.uint8)
                cv2.putText(frame, "CAMERA OFFLINE / DISCONNECTED", (width // 10, height // 2), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                cv2.putText(frame, f"Source: {video_source}", (width // 10, height // 2 + 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                
                # Sleep a little to prevent high CPU utilization in failure loops
                time.sleep(0.2)
                
                # Skip vehicle detection but keep main logic moving
                vehicles = []
            else:
                # Detect & Track Vehicles
                vehicles = detect_and_track(frame)
            
            # Aggregate counts for each virtual lane in this frame
            lane_counts = {lane: 0 for lane in LANES}
            for v in vehicles:
                lane_counts[v["lane"]] += 1

            # Update traffic signal cycles (dynamic timers)
            signal_states, time_remaining = cycle.update(lane_counts)

            # Sync signal states to Backend API periodically
            now = time.time()
            if now - last_sync_time >= sync_interval:
                for lane, state_info in signal_states.items():
                    push_signal_state({
                        "lane": lane,
                        "signal": state_info["signal"],
                        "duration": time_remaining if state_info["signal"] in ["GREEN", "ORANGE"] else state_info["duration"],
                        "count": state_info["count"]
                    })
                last_sync_time = now

            # Reset violation detector for lanes that are GREEN or ORANGE
            for lane, state_info in signal_states.items():
                if state_info["signal"] != "RED":
                    violation_detector.reset_for_lane(lane)

            # Check for Red Light Violators
            violators = violation_detector.check(vehicles, signal_states)
            pending_violations = []
            for v in violators:
                # Perform OCR on number plate
                plate = read_plate(frame, v["bbox"])
                print(f"[Violation Detected] Vehicle {v['id']} in {v['lane']} lane crossed stop line on RED! OCR Result: {plate or 'UNREADABLE'}")
                pending_violations.append((v, plate))

            # Determine color and text based on active signal of north lane
            north_state = signal_states.get("north", {})
            lane_sig = north_state.get("signal", "RED")
            total_count = north_state.get("count", 0)
            
            if lane_sig == "GREEN":
                sig_color = (0, 255, 0) # Green
                sig_text = "SIGNAL: GREEN"
            elif lane_sig == "ORANGE":
                sig_color = (0, 165, 255) # Orange
                sig_text = f"SIGNAL: ORANGE ({time_remaining}s)"
            else:
                sig_color = (0, 0, 255) # Red
                sig_text = "SIGNAL: RED"

            # Draw Stop Line with active signal color
            cv2.line(frame, *stop_line, sig_color, 3)
            cv2.putText(frame, f"STOP LINE - {sig_text}", (50, stop_line_y - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.6, sig_color, 2)

            # Draw Density HUD overlay
            density_desc = "HIGH" if total_count >= 5 else "LOW" if total_count <= 1 else "MODERATE"
            cv2.rectangle(frame, (15, 15), (320, 85), (0, 0, 0), -1) # Dark HUD background
            cv2.rectangle(frame, (15, 15), (320, 85), (100, 100, 100), 1)
            cv2.putText(frame, f"DENSITY: {total_count} ({density_desc})", (25, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(frame, sig_text, (25, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.7, sig_color, 2)

            # Draw bounding boxes and labels for vehicles
            for v in vehicles:
                x1, y1, x2, y2 = v["bbox"]
                cv2.rectangle(frame, (x1, y1), (x2, y2), sig_color, 2)
                
                # Label box with ID
                label = f"ID: {v['id']}"
                cv2.putText(frame, label, (x1, max(y1 - 5, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, sig_color, 2)

            # Update latest frame for Flask streamer
            global latest_frame
            with frame_lock:
                latest_frame = frame.copy()

            # Save and upload full annotated screenshot for each pending violation
            for v, plate in pending_violations:
                timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                local_filename = f"violation_crops/violation_{v['lane']}_{v['id']}_{timestamp_str}.jpg"
                
                # Save the fully annotated frame!
                cv2.imwrite(local_filename, frame)
                
                # Push to backend
                push_violation({
                    "lane": v["lane"],
                    "vehicleId": v["id"],
                    "plate": plate or "UNREADABLE",
                    "timestamp": datetime.utcnow().isoformat()
                }, local_filename)

            # Display frame if not running in headless mode
            if not headless:
                cv2.imshow("Smart Traffic AI Controller", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    print("Quit key pressed. Exiting...")
                    break
    except KeyboardInterrupt:
        print("Keyboard interrupt received. Exiting...")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("Video capture stopped and resources released.")

def fetch_camera_source():
    try:
        r = requests.get(f"{BACKEND_URL}/config", timeout=2)
        if r.status_code == 200:
            src = r.json().get("cameraSource", "0")
            print(f"[Config] Loaded camera source from backend: {src}")
            return src
    except Exception as e:
        print(f"[Config] Could not fetch camera source from backend, using default '0': {e}")
    return "0"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Smart AI Traffic Management System Controller")
    parser.add_argument("--source", type=str, default=None, help="Video source file or camera index (default: 0 for webcam)")
    parser.add_argument("--headless", action="store_true", help="Run without opening window visualization (useful for servers)")
    args = parser.parse_args()

    # If source is explicitly provided, use it. Otherwise fallback to database config or default '0'
    if args.source is not None:
        src = args.source
    else:
        backend_src = fetch_camera_source()
        src = backend_src if backend_src else "0"

    # Determine if source is an integer (camera index)
    if src.isdigit():
        src = int(src)

    run(video_source=src, headless=args.headless)
