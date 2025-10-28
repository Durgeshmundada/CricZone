// backend/models/Turf.js
const mongoose = require("mongoose");

const turfSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter turf name"],
  },
  location: {
    type: String,
    required: [true, "Please enter location"],
  },
  pricePerHour: {
    type: Number,
    required: [true, "Please specify price per hour"],
  },
  type: {
    type: String,
    enum: ["football", "cricket", "multi-purpose"],
    default: "multi-purpose",
  },
  availableSlots: [
    {
      date: String,
      slots: [String], // e.g., ["6AM-7AM", "7AM-8AM"]
    },
  ],
  images: [String],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Turf", turfSchema);
