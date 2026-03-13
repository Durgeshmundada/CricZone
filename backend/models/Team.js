// backend/models/Team.js
const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Team name is required"],
    trim: true,
    maxlength: 80
  },
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tournament"
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  members: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    isRegistered: {
      type: Boolean,
      default: false
    },
    inviteStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "accepted"
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    invitedAt: {
      type: Date,
      default: null
    },
    respondedAt: {
      type: Date,
      default: null
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  stats: {
    matchesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

teamSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Team", teamSchema);
