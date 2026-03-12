const mongoose = require("mongoose");

const turfSchema = new mongoose.Schema(
  {
    turfName: {
      type: String,
      required: [true, "Please enter turf name"],
      trim: true
    },
    name: {
      type: String,
      trim: true
    },
    location: {
      address: { type: String, required: true, trim: true },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" }
    },
    pricePerHour: {
      type: Number,
      required: [true, "Please specify price per hour"],
      min: 0
    },
    basePricingPerSlot: {
      type: Number,
      min: 0
    },
    sportTypes: {
      type: [String],
      default: ["cricket"]
    },
    surfaceType: {
      type: String,
      default: "Standard"
    },
    type: {
      type: String,
      enum: ["football", "cricket", "multi-purpose"],
      default: "cricket"
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    images: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Turf", turfSchema);
