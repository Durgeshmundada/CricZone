// backend/models/Match.js
const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  matchName: {
    type: String,
    required: true,
    trim: true
  },
  matchType: {
    type: String,
    enum: ["T20", "ODI", "Test", "Custom"],
    required: true
  },
  overs: {
    type: Number,
    default: 20
  },
  teamA: {
    name: { type: String, required: true },
    players: [{ type: String }],
    score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 }
  },
  teamB: {
    name: { type: String, required: true },
    players: [{ type: String }],
    score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 }
  },
  venue: {
    type: String,
    required: true
  },
  matchDate: {
    type: Date,
    required: true
  },
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tournament",
    default: null
  },
  status: {
    type: String,
    enum: ["scheduled", "live", "completed", "cancelled"],
    default: "scheduled"
  },
  tossWinner: {
    type: String,
    default: null
  },
  tossDecision: {
    type: String,
    enum: ["bat", "bowl", null],
    default: null
  },
  winner: {
    type: String,
    default: null
  },
  result: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  scorers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model("Match", matchSchema);