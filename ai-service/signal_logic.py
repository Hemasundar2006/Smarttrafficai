"""
Density-Based Traffic Control timing logic.
Implements specific rules for webcam demo based on vehicle count:
- High Traffic (>= 5): GREEN light.
- Low Traffic (<= 1): RED light.
- Moderate Traffic (2 to 4): ORANGE light with 10s countdown, then RED.
"""
import time

class SignalCycle:
    def __init__(self, lanes):
        self.lanes = lanes
        self.webcam_lane = "north" # The primary monitored lane
        
        # Initial signals state
        self.current_signals = {lane: "RED" for lane in lanes}
        self.durations = {lane: 0 for lane in lanes}
        
        # State tracking for Moderate density countdown
        self.orange_countdown = 10
        self.last_countdown_time = 0
        self.moderate_completed = False
        
        # Track previous density state to detect transitions
        self.prev_state_type = None

    def update(self, lane_counts):
        """
        Calculates signal states based on the total vehicle density in the camera frame.
        Returns:
            state (dict): Map of lane -> {signal, duration, count}
            time_remaining (int): Seconds left in the active phase / countdown
        """
        now = time.time()
        
        # Use total count across all screen columns as the traffic density
        total_count = sum(lane_counts.values())
        
        # Classify current traffic density
        if total_count >= 5:
            current_state_type = "HIGH"
        elif total_count <= 1:
            current_state_type = "LOW"
        else:
            current_state_type = "MODERATE"
            
        # Reset countdown state if density level changes
        if current_state_type != self.prev_state_type:
            self.moderate_completed = False
            self.orange_countdown = 10
            self.prev_state_type = current_state_type

        # State machine logic for webcam lane
        if current_state_type == "HIGH":
            # 1. High Traffic -> Immediately turn on GREEN light
            self.current_signals[self.webcam_lane] = "GREEN"
            self.durations[self.webcam_lane] = 99  # Continuous green signal
            
        elif current_state_type == "LOW":
            # 2. Low Traffic -> Automatically show RED light
            self.current_signals[self.webcam_lane] = "RED"
            self.durations[self.webcam_lane] = 0
            
        else: # MODERATE
            # 3. Moderate Traffic -> ORANGE light with 10s countdown, then RED
            if self.moderate_completed:
                self.current_signals[self.webcam_lane] = "RED"
                self.durations[self.webcam_lane] = 0
            else:
                if self.current_signals[self.webcam_lane] != "ORANGE":
                    self.current_signals[self.webcam_lane] = "ORANGE"
                    self.orange_countdown = 10
                    self.last_countdown_time = now
                else:
                    # Decrement countdown every 1.0s
                    if now - self.last_countdown_time >= 1.0:
                        self.orange_countdown = max(0, self.orange_countdown - 1)
                        self.last_countdown_time = now
                        if self.orange_countdown == 0:
                            # Countdown complete -> transition to RED
                            self.current_signals[self.webcam_lane] = "RED"
                            self.durations[self.webcam_lane] = 0
                            self.moderate_completed = True
                            
                if self.current_signals[self.webcam_lane] == "ORANGE":
                    self.durations[self.webcam_lane] = self.orange_countdown

        # Update other lanes to remain RED for simplicity during the webcam demo
        for lane in self.lanes:
            if lane != self.webcam_lane:
                self.current_signals[lane] = "RED"
                self.durations[lane] = 0

        # Construct signal states payload
        state = {}
        for lane in self.lanes:
            state[lane] = {
                "signal": self.current_signals[lane],
                "duration": self.durations[lane],
                # Distribute counts: webcam_lane gets the total, others get 0
                "count": total_count if lane == self.webcam_lane else 0
            }

        active_duration = self.durations[self.webcam_lane]
        return state, active_duration

    def force_advance(self):
        self.moderate_completed = False
        self.orange_countdown = 10
