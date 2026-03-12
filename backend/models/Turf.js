<<<<<<< HEAD
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
=======
// ===============================
// Turf model
// ===============================

const mongoose = require('mongoose');

const turfSchema = new mongoose.Schema(
  {
    // Basic Info
    turfName: {
      type: String,
      required: [true, 'Please provide turf name'],
      trim: true,
      maxlength: [100, 'Turf name cannot exceed 100 characters']
    },
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878

    // Owner Reference
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Location
    location: {
      address: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      pincode: {
        type: String,
        required: true
      },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true
        }
      }
    },

    // Turf Details
    sportTypes: {
      type: [String],
      enum: ['cricket', 'football', 'badminton', 'tennis', 'volleyball'],
      required: true
    },

    turfSize: {
      length: {
        type: Number,
        required: true
      },
      width: {
        type: Number,
        required: true
      },
      unit: {
        type: String,
        default: 'meters'
      }
    },

    surfaceType: {
      type: String,
      enum: ['artificial grass', 'natural grass', 'synthetic'],
      required: true
    },

    // Amenities
    amenities: {
      parking: Boolean,
      changingRooms: Boolean,
      lighting: Boolean,
      cafeteria: Boolean,
      washrooms: Boolean
    },

    // Images
    images: [
      {
        type: String,
        default: null
      }
    ],

    // Pricing
    basePricingPerSlot: {
      type: Number,
      required: true
    },

    // Ratings
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

    // Status
    isActive: {
      type: Boolean,
      default: true
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Create geospatial index for location-based search
turfSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Turf', turfSchema);
