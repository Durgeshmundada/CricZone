// backend/models/Turf.js
const mongoose = require("mongoose");

const turfSchema = new mongoose.Schema(
  {
    turfName: {
      type: String,
      required: [true, "Please provide turf name"],
      trim: true,
      maxlength: [100, "Turf name cannot exceed 100 characters"]
    },

    // Alias for backward compat
    name: {
      type: String,
      trim: true
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    location: {
      address: { type: String, required: true },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point"
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [0, 0]
        }
      }
    },

    sportTypes: {
      type: [String],
      default: ["cricket"]
    },

    turfSize: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      unit: { type: String, default: "meters" }
    },

    surfaceType: {
      type: String,
      default: "artificial grass"
    },

    type: {
      type: String,
      enum: ["football", "cricket", "multi-purpose"],
      default: "cricket"
    },

    amenities: {
      parking: Boolean,
      changingRooms: Boolean,
      lighting: Boolean,
      cafeteria: Boolean,
      washrooms: Boolean
    },

    images: {
      type: [String],
      default: []
    },

    pricePerHour: {
      type: Number,
      min: 0,
      default: 0
    },

    basePricingPerSlot: {
      type: Number,
      min: 0,
      default: 0
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },

    totalReviews: {
      type: Number,
      default: 0
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

// Create geospatial index for location-based search
turfSchema.index({ "location.coordinates": "2dsphere" });

module.exports = mongoose.model("Turf", turfSchema);
