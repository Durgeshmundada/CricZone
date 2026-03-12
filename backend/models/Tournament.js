const mongoose = require("mongoose");

const registeredPlayerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { _id: false }
);

const registeredTeamSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    teamName: { type: String, required: true, trim: true },
    captain: { type: String, required: true, trim: true },
    viceCaptain: { type: String, default: "", trim: true },
    wicketkeeper: { type: String, default: "", trim: true },
    coach: { type: String, default: "", trim: true },
    players: { type: [registeredPlayerSchema], default: [] },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const tournamentSchema = new mongoose.Schema(
  {
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
      required: true,
      trim: true
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
    minPlayers: {
      type: Number,
      default: 11,
      min: 2
    },
    maxPlayers: {
      type: Number,
      default: 15,
      min: 2
    },
    registeredTeams: {
      type: [registeredTeamSchema],
      default: []
    },
    status: {
      type: String,
      enum: ["upcoming", "registration_open", "ongoing", "playoffs", "completed", "cancelled"],
      default: "upcoming"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    matches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      }
    ],
    winner: {
      type: String,
      default: null
    },
    prizePool: {
      type: String,
      default: "TBD"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Tournament", tournamentSchema);
