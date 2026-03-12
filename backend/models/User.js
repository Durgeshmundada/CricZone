const mongoose = require("mongoose");

const battingStatsSchema = new mongoose.Schema(
  {
    innings: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    ballsFaced: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 }
  },
  { _id: false }
);

const bowlingStatsSchema = new mongoose.Schema(
  {
    balls: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    economy: { type: Number, default: 0 }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: ""
    },
    role: {
      type: String,
      enum: ["player", "admin", "turf_owner"],
      default: "player"
    },
    profile: {
      displayName: { type: String, default: "" },
      playerType: { type: String, default: "Player" },
      availabilityStatus: { type: String, default: "Available" }
    },
    media: {
      profilePicture: { type: String, default: "" }
    },
    stats: {
      matchesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      batting: {
        type: battingStatsSchema,
        default: () => ({})
      },
      bowling: {
        type: bowlingStatsSchema,
        default: () => ({})
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
