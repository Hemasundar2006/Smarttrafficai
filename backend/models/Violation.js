const mongoose = require("mongoose");

const violationSchema = new mongoose.Schema({
  lane: String,
  vehicleId: Number,
  plate: String,
  imageUrl: String,
  timestamp: { type: Date, default: Date.now },
  challanGenerated: { type: Boolean, default: false }
});

module.exports = mongoose.model("Violation", violationSchema);
