import os
import urllib.request

VIDEO_URLS = [
    "https://github.com/FarzadNekouee/YOLOv8_Traffic_Density_Estimation/raw/master/sample_video.mp4",
    "https://github.com/FarzadNekouee/YOLOv8_Traffic_Density_Estimation/raw/main/sample_video.mp4"
]
OUTPUT_FILE = "sample_traffic.mp4"

def download_video():
    if os.path.exists(OUTPUT_FILE):
        print(f"{OUTPUT_FILE} already exists. Skipping download.")
        return True
    
    for url in VIDEO_URLS:
        print(f"Trying download from {url}...")
        try:
            def progress(count, block_size, total_size):
                if total_size > 0:
                    percent = min(100, int(count * block_size * 100 / total_size))
                    print(f"\rDownloading: {percent}% completed", end="")
                else:
                    print(f"\rDownloaded {count * block_size} bytes", end="")
                
            urllib.request.urlretrieve(url, OUTPUT_FILE, reporthook=progress)
            print("\nDownload complete!")
            return True
        except Exception as e:
            print(f"\nFailed to download from {url}: {e}")
            if os.path.exists(OUTPUT_FILE):
                os.remove(OUTPUT_FILE)
            
    print("Could not download any sample video files.")
    return False

if __name__ == "__main__":
    download_video()
