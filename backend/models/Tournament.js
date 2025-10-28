// backend/models/Tournament.js
const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Tournament name is required"],
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  venue: {
    type: String,
    required: true
  },
  format: {
    type: String,
    enum: ["T20", "ODI", "Test", "Custom"],
    default: "T20"
  },
  maxTeams: {
    type: Number,
    default: 8,
    min: 2
  },
  registeredTeams: [{
    teamName: String,
    captain: String,
    players: [String],
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    registeredAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ["upcoming", "ongoing", "completed", "cancelled"],
    default: "upcoming"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  matches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Match"
  }],
  winner: {
    type: String,
    default: null
  },
  prizePool: {
    type: String,
    default: "TBD"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Tournament", tournamentSchema);