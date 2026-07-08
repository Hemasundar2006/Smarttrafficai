require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("./models/User");
const SignalState = require("./models/SignalState");
const Violation = require("./models/Violation");

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/traffic_system";

async function run() {
  console.log("Connecting to MongoDB...");
  try {
    await mongoose.connect(mongoURI);
    console.log("Connected successfully!");

    // Clear existing collections
    console.log("Clearing existing data...");
    await SignalState.deleteMany({});
    await Violation.deleteMany({});
    await User.deleteMany({});

    // 1. Seed admin credentials
    console.log("Seeding admin credentials...");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync("ongpolice", salt, 1000, 64, "sha512").toString("hex");
    await User.create({
      email: "ongolepolice100@gmail.com",
      salt,
      hash
    });
    console.log("Admin user created: ongolepolice100@gmail.com / ongpolice");

    // 2. Seed traffic signal density states
    console.log("Seeding traffic signal density states...");
    await SignalState.create([
      { lane: "north", signal: "RED", duration: 12, count: 4 },
      { lane: "south", signal: "GREEN", duration: 25, count: 6 },
      { lane: "east", signal: "RED", duration: 12, count: 1 },
      { lane: "west", signal: "RED", duration: 12, count: 2 }
    ]);

    // 3. Seed sample traffic violations
    console.log("Seeding sample traffic violations...");
    await Violation.create([
      { lane: "north", vehicleId: 4, plate: "AP27AX9821", imageUrl: null, timestamp: new Date(Date.now() - 3600000) },
      { lane: "east", vehicleId: 18, plate: "MH12CD5678", imageUrl: null, timestamp: new Date(Date.now() - 7200000) },
      { lane: "west", vehicleId: 23, plate: "KA03MM1122", imageUrl: null, timestamp: new Date(Date.now() - 10800000) },
      { lane: "north", vehicleId: 35, plate: "DL04CA4321", imageUrl: null, timestamp: new Date(Date.now() - 14400000) }
    ]);

    console.log("\nDatabase seeded successfully!");
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

run();
