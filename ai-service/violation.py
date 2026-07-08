import cv2
import numpy as np

def crossed_line(bbox, line_p1, line_p2):
    """
    Checks whether the bottom-center point of a vehicle bbox has crossed
    the virtual stop line (line_p1 -> line_p2).
    Returns (crossed, (cx, cy))
    """
    x1, y1, x2, y2 = bbox
    cx, cy = (x1 + x2) // 2, y2  # bottom-center (wheels contacting road)

    (lx1, ly1), (lx2, ly2) = line_p1, line_p2
    
    # Calculate cross product to determine which side of the line the point is on.
    # Positive indicates crossed (assuming traffic moves downwards past line).
    d = (lx2 - lx1) * (cy - ly1) - (ly2 - ly1) * (cx - lx1)
    return d > 0, (cx, cy)


class ViolationDetector:
    def __init__(self, stop_line):
        self.stop_line = stop_line          # ((x1,y1),(x2,y2))
        # Keep track of flagged vehicle IDs per lane to prevent double detection
        self.already_flagged = {
            "north": set(),
            "south": set(),
            "east": set(),
            "west": set()
        }

    def reset_for_lane(self, lane):
        """Clears flagged vehicles for a lane when it transitions to GREEN."""
        if lane in self.already_flagged:
            self.already_flagged[lane].clear()

    def check(self, vehicles, signal_states):
        """
        Checks if any tracked vehicle in a RED signal lane has crossed the stop line.
        Returns:
            violators (list): List of vehicle dicts that violated the red light
        """
        violators = []

        for v in vehicles:
            lane = v["lane"]
            # Look up current signal for the vehicle's lane
            lane_signal = signal_states.get(lane, {}).get("signal", "RED")
            
            # Check violation ONLY if the lane signal is RED
            if lane_signal == "RED":
                crossed, point = crossed_line(v["bbox"], *self.stop_line)
                v_id = v["id"]
                
                if crossed and v_id not in self.already_flagged[lane]:
                    self.already_flagged[lane].add(v_id)
                    violators.append(v)
                    
        return violators
