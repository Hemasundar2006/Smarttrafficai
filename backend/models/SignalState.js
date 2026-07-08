const mongoose = require("mongoose");

const signalStateSchema = new mongoose.Schema({
  lane: String,
  signal: { type: String, enum: ["GREEN", "ORANGE", "RED"] },
  duration: Number,
  count: Number,
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SignalState", signalStateSchema);
