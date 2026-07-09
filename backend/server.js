require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");
const crypto = require("crypto");

const Violation = require("./models/Violation");
const SignalState = require("./models/SignalState");
const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));

// Configure multer to use memory storage for cloud deployment compatibility
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Define Config model directly for persistent remote system configuration
const configSchema = new mongoose.Schema({
  cameraSource: { type: String, default: "standby" },
  manualOverride: { type: Boolean, default: false }
});
const Config = mongoose.model("Config", configSchema);

async function seedAdmin() {
  try {
    const adminExists = await User.findOne({ email: "ongolepolice100@gmail.com" });
    if (!adminExists) {
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.pbkdf2Sync("ongpolice", salt, 1000, 64, "sha512").toString("hex");
      await User.create({
        email: "ongolepolice100@gmail.com",
        salt,
        hash
      });
      console.log("[Database Seeder] Default admin user created successfully.");
    }
  } catch (err) {
    console.error("Error seeding default admin:", err);
  }
}

// Database Connection
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/traffic_system";
mongoose.connect(mongoURI)
  .then(() => {
    console.log(`MongoDB connected successfully to cluster.`);
    seedAdmin();
  })
  .catch(err => {
    console.error("\n========================================================");
    console.error("FATAL ERROR: Failed to connect to MongoDB Atlas cluster.");
    console.error("Connection string:", mongoURI);
    console.error("Error details:", err.message || err);
    console.error("========================================================\n");
    process.exit(1);
  });

// ---- Authentication APIs ----
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid Email or Password" });
    }
    const hash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, "sha512").toString("hex");
    if (hash === user.hash) {
      res.json({ success: true, message: "Logged in successfully" });
    } else {
      res.status(401).json({ success: false, message: "Invalid Email or Password" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ---- Configuration APIs ----
app.get("/api/config", async (req, res) => {
  try {
    let cfg = await Config.findOne();
    if (!cfg) {
      cfg = await Config.create({ cameraSource: "0" });
    }
    res.json(cfg);
  } catch (error) {
    console.error("Error retrieving config:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/config", async (req, res) => {
  try {
    const { cameraSource, manualOverride } = req.body;
    if (cameraSource === undefined && manualOverride === undefined) {
      return res.status(400).json({ error: "cameraSource or manualOverride is required" });
    }
    let cfg = await Config.findOne();
    if (!cfg) {
      cfg = new Config();
    }
    if (cameraSource !== undefined) {
      cfg.cameraSource = String(cameraSource);
    }
    if (manualOverride !== undefined) {
      cfg.manualOverride = Boolean(manualOverride);
    }
    await cfg.save();
    console.log(`[Config Updated] Camera Source set to: ${cfg.cameraSource}, Manual Override: ${cfg.manualOverride}`);
    res.json(cfg);
  } catch (error) {
    console.error("Error updating config:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---- Signal State APIs ----
app.post("/api/signal", async (req, res) => {
  try {
    const { lane, signal, duration, count } = req.body;
    if (!lane || !signal) {
      return res.status(400).json({ error: "lane and signal are required" });
    }

    const updated = await SignalState.findOneAndUpdate(
      { lane },
      { signal, duration, count, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(updated);
  } catch (error) {
    console.error("Error updating signal state:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/signal", async (req, res) => {
  try {
    const states = await SignalState.find();
    res.json(states);
  } catch (error) {
    console.error("Error retrieving signal states:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---- Violations APIs ----
app.post("/api/violations", upload.single("image"), async (req, res) => {
  try {
    const { lane, vehicleId, plate, timestamp } = req.body;
    let imageUrl = null;
    if (req.file) {
      const base64Data = req.file.buffer.toString('base64');
      // Convert buffer to base64 data URI to store directly in MongoDB (cloud safe)
      imageUrl = `data:${req.file.mimetype || 'image/jpeg'};base64,${base64Data}`;
    }

    const violation = await Violation.create({
      lane,
      vehicleId: vehicleId ? parseInt(vehicleId, 10) : undefined,
      plate: plate || "UNREADABLE",
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      imageUrl
    });
    
    console.log(`[Violation Recorded] Lane: ${lane}, Vehicle ID: ${vehicleId}, Plate: ${plate}`);
    res.status(201).json(violation);
  } catch (error) {
    console.error("Error creating violation:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/violations", async (req, res) => {
  try {
    const violations = await Violation.find().sort({ timestamp: -1 }).limit(100);
    res.json(violations);
  } catch (error) {
    console.error("Error retrieving violations:", error);
    res.status(550).json({ error: "Internal Server Error" });
  }
});

app.post("/api/violations/:id/challan", async (req, res) => {
  try {
    const { id } = req.params;
    const violation = await Violation.findByIdAndUpdate(
      id,
      { challanGenerated: true },
      { new: true }
    );
    if (!violation) {
      return res.status(404).json({ error: "Violation not found" });
    }
    console.log(`[Challan Issued] Issued citation for Violation ID: ${id}, Plate: ${violation.plate}`);
    res.json(violation);
  } catch (error) {
    console.error("Error issuing challan:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---- Database Seeding API ----
app.get("/api/seed", async (req, res) => {
  try {
    // Clear existing sample data
    await SignalState.deleteMany({});
    await Violation.deleteMany({});
    await User.deleteMany({});

    // Seed admin credentials
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync("ongpolice", salt, 1000, 64, "sha512").toString("hex");
    await User.create({
      email: "ongolepolice100@gmail.com",
      salt,
      hash
    });

    // Seed traffic signal density states
    await SignalState.create([
      { lane: "north", signal: "RED", duration: 12, count: 4 },
      { lane: "south", signal: "GREEN", duration: 25, count: 6 },
      { lane: "east", signal: "RED", duration: 12, count: 1 },
      { lane: "west", signal: "RED", duration: 12, count: 2 }
    ]);

    // Seed sample traffic violations
    await Violation.create([
      { lane: "north", vehicleId: 4, plate: "AP27AX9821", imageUrl: null, timestamp: new Date(Date.now() - 3600000) },
      { lane: "east", vehicleId: 18, plate: "MH12CD5678", imageUrl: null, timestamp: new Date(Date.now() - 7200000) },
      { lane: "west", vehicleId: 23, plate: "KA03MM1122", imageUrl: null, timestamp: new Date(Date.now() - 10800000) },
      { lane: "north", vehicleId: 35, plate: "DL04CA4321", imageUrl: null, timestamp: new Date(Date.now() - 14400000) }
    ]);

    res.json({ success: true, message: "Database seeded successfully with sample signals and violations!" });
  } catch (error) {
    console.error("Seeding error:", error);
    res.status(500).json({ success: false, message: "Failed to seed database" });
  }
});

// ---- Health Check ----
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    database: "mongodb", 
    timestamp: new Date() 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
