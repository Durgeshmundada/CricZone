// backend/models/Match.js
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchName: {
    type: String,
    required: true
  },
  matchType: {
    type: String,
    required: true,
    enum: ['T20', 'ODI', 'Test', 'Custom']
  },
  totalOvers: {
    type: Number,
    default: 20
  },
  ballsPerOver: {
    type: Number,
    default: 6
  },
  teamA: {
    name: { type: String, required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, // ✅ BUG #3 FIX
    players: [String],
    score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: String, default: "0" },
    ballsPlayed: { type: Number, default: 0 } // ✅ Track total balls
  },
  teamB: {
    name: { type: String, required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, // ✅ BUG #3 FIX
    players: [String],
    score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: String, default: "0" },
    ballsPlayed: { type: Number, default: 0 } // ✅ Track total balls
  },
  venue: {
    type: String,
    required: true
  },
  matchDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'upcoming', 'live', 'innings_break', 'completed'],
    default: 'scheduled'
  },
  winner: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament'
  },
  currentInning: {
    type: Number,
    default: 1
  },
  currentBatsman: {
    type: String,
    default: null
  },
  currentBowler: {
    type: String,
    default: null
  },
  // ✅ BUG #1, #5, #10 FIX: Enhanced inning tracking
  innings: {
    first: {
      battingTeam: String,
      score: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      isCompleted: { type: Boolean, default: false },
      extras: {
        wides: { type: Number, default: 0 },
        noBalls: { type: Number, default: 0 },
        byes: { type: Number, default: 0 },
        legByes: { type: Number, default: 0 }
      }
    },
    second: {
      battingTeam: String,
      score: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      isCompleted: { type: Boolean, default: false },
      target: { type: Number, default: 0 },
      extras: {
        wides: { type: Number, default: 0 },
        noBalls: { type: Number, default: 0 },
        byes: { type: Number, default: 0 },
        legByes: { type: Number, default: 0 }
      }
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Match', matchSchema);
