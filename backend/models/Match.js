const mongoose = require("mongoose");

const playerLinkSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isRegistered: { type: Boolean, default: false }
  },
  { _id: false }
);

const teamSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    players: { type: [String], default: [] },
    playerLinks: { type: [playerLinkSchema], default: [] },
    score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: String, default: "0.0" }
  },
  { _id: false }
);

const ballEventSchema = new mongoose.Schema(
  {
    inning: { type: Number, required: true },
    ballNumber: { type: Number, required: true },
    over: { type: Number, required: true },
    ballInOver: { type: Number, required: true },
    totalRuns: { type: Number, default: 0 },
    batsmanRuns: { type: Number, default: 0 },
    batsmanName: { type: String, default: "" },
    batsmanId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    nonStrikerName: { type: String, default: "" },
    nonStrikerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    bowlerName: { type: String, default: "" },
    bowlerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    extras: {
      type: {
        type: String,
        default: null
      },
      runs: {
        type: Number,
        default: 0
      }
    },
    isWicket: { type: Boolean, default: false },
    wicket: {
      kind: { type: String, default: null },
      playerOutName: { type: String, default: null },
      playerOutId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
    },
    isReverted: { type: Boolean, default: false }
  },
  { _id: false }
);

const inningsSnapshotSchema = new mongoose.Schema(
  {
    battingTeam: { type: String, enum: ["teamA", "teamB"], default: "teamA" },
    score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: String, default: "0.0" },
    balls: { type: Number, default: 0 },
    target: { type: Number, default: 0 },
    runRate: { type: Number, default: 0 },
    requiredRunRate: { type: Number, default: 0 },
    isComplete: { type: Boolean, default: false }
  },
  { _id: false }
);

const batsmanStatsSchema = new mongoose.Schema(
  {
    inning: { type: Number, required: true },
    name: { type: String, required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    runs: { type: Number, default: 0 },
    ballsFaced: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 },
    isOut: { type: Boolean, default: false },
    dismissal: {
      kind: { type: String, default: null },
      bowlerName: { type: String, default: null },
      fielderName: { type: String, default: null }
    }
  },
  { _id: false }
);

const bowlerStatsSchema = new mongoose.Schema(
  {
    inning: { type: Number, required: true },
    name: { type: String, required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    balls: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    economy: { type: Number, default: 0 }
  },
  { _id: false }
);

const fallOfWicketSchema = new mongoose.Schema(
  {
    inning: { type: Number, required: true },
    wicketNumber: { type: Number, required: true },
    playerOut: { type: String, required: true },
    score: { type: Number, required: true },
    overs: { type: String, required: true }
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    matchName: { type: String, required: true, trim: true },
    matchType: {
      type: String,
      enum: ["T20", "ODI", "Test", "Custom"],
      default: "T20"
    },
    oversLimit: { type: Number, required: true, min: 1 },
    venue: { type: String, required: true, trim: true },
    matchDate: { type: Date, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      default: null
    },
    teamA: {
      type: teamSnapshotSchema,
      required: true
    },
    teamB: {
      type: teamSnapshotSchema,
      required: true
    },
    toss: {
      winner: { type: String, enum: ["teamA", "teamB"], default: null },
      decision: { type: String, enum: ["bat", "bowl"], default: null },
      at: { type: Date, default: null }
    },
    status: {
      type: String,
      enum: ["scheduled", "live", "completed", "cancelled", "upcoming"],
      default: "scheduled"
    },
    currentInning: {
      type: Number,
      enum: [1, 2],
      default: 1
    },
    innings: {
      first: {
        type: inningsSnapshotSchema,
        default: () => ({ battingTeam: "teamA" })
      },
      second: {
        type: inningsSnapshotSchema,
        default: () => ({ battingTeam: "teamB" })
      }
    },
    currentStriker: { type: String, default: "" },
    currentStrikerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    currentNonStriker: { type: String, default: "" },
    currentNonStrikerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    currentBowler: { type: String, default: "" },
    currentBowlerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ballByBallData: {
      type: [ballEventSchema],
      default: []
    },
    batsmanStats: {
      type: [batsmanStatsSchema],
      default: []
    },
    bowlerStats: {
      type: [bowlerStatsSchema],
      default: []
    },
    fallOfWickets: {
      type: [fallOfWicketSchema],
      default: []
    },
    result: {
      winnerTeam: { type: String, enum: ["teamA", "teamB"], default: null },
      message: { type: String, default: "" }
    },
    statsAppliedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Match", matchSchema);
