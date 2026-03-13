// backend/models/Match.js
const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  // ========== BASIC MATCH INFO ==========
  matchName: {
    type: String,
    required: true,
    trim: true
  },
  matchType: {
    type: String,
    required: true,
    enum: ["T20", "ODI", "Test", "Custom"]
  },
  totalOvers: {
    type: Number,
    default: 20
  },
  // Alias for backward compat
  oversLimit: {
    type: Number,
    default: 20,
    min: 1
  },
  ballsPerOver: {
    type: Number,
    default: 6
  },

  // ========== TEAM INFORMATION ==========
  teamA: {
    name: { type: String, required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    players: [String],
    playerLinks: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, required: true },
      email: String,
      isRegistered: { type: Boolean, default: false }
    }],
    captain: String,
    wicketkeeper: String,
    score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: String, default: "0.0" },
    ballsPlayed: { type: Number, default: 0 }
  },
  teamB: {
    name: { type: String, required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    players: [String],
    playerLinks: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, required: true },
      email: String,
      isRegistered: { type: Boolean, default: false }
    }],
    captain: String,
    wicketkeeper: String,
    score: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: String, default: "0.0" },
    ballsPlayed: { type: Number, default: 0 }
  },

  // ========== MATCH METADATA ==========
  venue: {
    type: String,
    required: true,
    trim: true
  },
  matchDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["scheduled", "upcoming", "live", "innings_break", "completed", "abandoned", "cancelled"],
    default: "scheduled"
  },
  winner: {
    type: String,
    default: null
  },
  resultType: {
    type: String,
    enum: ["runs", "wickets", "tie", "no_result", "abandoned"],
    default: null
  },
  resultMargin: {
    type: Number,
    default: null
  },
  // Backward compatibility
  result: {
    winnerTeam: { type: String, enum: ["teamA", "teamB"], default: null },
    message: { type: String, default: "" }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tournament"
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tournament",
    default: null
  },

  // ========== TOSS INFORMATION ==========
  toss: {
    winner: { type: String, default: null },
    decision: {
      type: String,
      enum: ["bat", "bowl"],
      default: null
    },
    at: { type: Date, default: null }
  },

  // ========== CURRENT MATCH STATE ==========
  currentInning: {
    type: Number,
    default: 1,
    enum: [1, 2]
  },
  currentStriker: { type: String, default: "" },
  currentStrikerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  currentNonStriker: { type: String, default: "" },
  currentNonStrikerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  currentBowler: { type: String, default: "" },
  currentBowlerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  currentOver: {
    overNumber: { type: Number, default: 0 },
    ballNumber: { type: Number, default: 0 }
  },
  statsProcessed: {
    type: Boolean,
    default: false
  },
  statsAppliedAt: {
    type: Date,
    default: null
  },

  // ========== INNINGS TRACKING ==========
  innings: {
    first: {
      battingTeam: { type: String, default: "teamA" },
      bowlingTeam: String,
      score: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      target: { type: Number, default: 0 },
      isComplete: { type: Boolean, default: false },
      isCompleted: { type: Boolean, default: false },
      runRate: { type: Number, default: 0 },
      requiredRunRate: { type: Number, default: 0 },
      extras: {
        total: { type: Number, default: 0 },
        wides: { type: Number, default: 0 },
        noBalls: { type: Number, default: 0 },
        byes: { type: Number, default: 0 },
        legByes: { type: Number, default: 0 },
        penalties: { type: Number, default: 0 }
      },
      powerplay: {
        overs: { type: Number, default: 6 },
        runs: { type: Number, default: 0 },
        wickets: { type: Number, default: 0 }
      },
      currentPartnership: {
        runs: { type: Number, default: 0 },
        balls: { type: Number, default: 0 },
        batsman1: String,
        batsman2: String
      }
    },
    second: {
      battingTeam: { type: String, default: "teamB" },
      bowlingTeam: String,
      score: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      target: { type: Number, default: 0 },
      isComplete: { type: Boolean, default: false },
      isCompleted: { type: Boolean, default: false },
      runRate: { type: Number, default: 0 },
      requiredRunRate: { type: Number, default: 0 },
      extras: {
        total: { type: Number, default: 0 },
        wides: { type: Number, default: 0 },
        noBalls: { type: Number, default: 0 },
        byes: { type: Number, default: 0 },
        legByes: { type: Number, default: 0 },
        penalties: { type: Number, default: 0 }
      },
      powerplay: {
        overs: { type: Number, default: 6 },
        runs: { type: Number, default: 0 },
        wickets: { type: Number, default: 0 }
      },
      currentPartnership: {
        runs: { type: Number, default: 0 },
        balls: { type: Number, default: 0 },
        batsman1: String,
        batsman2: String
      }
    }
  },

  // ========== BALL-BY-BALL DATA ==========
  ballByBallData: [{
    ballNumber: { type: Number, required: true },
    inning: { type: Number, enum: [1, 2], required: true },
    over: { type: Number, required: true },
    ballInOver: { type: Number, required: true },
    isLegalDelivery: { type: Boolean, default: true },

    batsmanName: { type: String, required: true },
    batsmanId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    nonStrikerName: String,
    nonStrikerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    bowlerName: { type: String, required: true },
    bowlerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    runs: { type: Number, default: 0, min: 0, max: 6 },
    totalRuns: { type: Number, default: 0 },
    batsmanRuns: { type: Number, default: 0 },

    extras: {
      total: { type: Number, default: 0 },
      type: {
        type: String,
        enum: ["wide", "noball", "bye", "legbye", "penalty", "none", null],
        default: "none"
      },
      runs: { type: Number, default: 0 }
    },

    isWicket: { type: Boolean, default: false },
    wicket: {
      playerOutName: String,
      playerOutId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      kind: {
        type: String,
        enum: ["bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket",
               "caught_and_bowled", "retired_hurt", "timed_out", "obstructing_field", null]
      },
      fielderName: String,
      fielderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },

    shot: {
      type: {
        type: String,
        enum: ["drive", "cut", "pull", "sweep", "flick", "push", "defense",
               "loft", "late_cut", "hook", "glance", "reverse_sweep", "other"]
      },
      timing: {
        type: String,
        enum: ["perfect", "good", "edge", "mistimed"]
      }
    },

    wagonWheel: {
      angle: Number,
      distance: Number,
      x: Number,
      y: Number
    },

    bowlingSpeed: Number,
    pitchMap: {
      length: {
        type: String,
        enum: ["full", "yorker", "good_length", "short", "bouncer"]
      },
      line: {
        type: String,
        enum: ["off_stump", "middle_stump", "leg_stump", "wide_outside_off", "down_leg"]
      }
    },

    commentary: String,
    isHighlight: { type: Boolean, default: false },
    highlightPriority: { type: Number, min: 0, max: 10, default: 0 },

    timestamp: { type: Date, default: Date.now },
    isReverted: { type: Boolean, default: false },
    revertedAt: Date
  }],

  // ========== BATSMAN STATISTICS ==========
  batsmanStats: [{
    name: { type: String, required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inning: { type: Number, enum: [1, 2] },
    runs: { type: Number, default: 0 },
    ballsFaced: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 },
    isOut: { type: Boolean, default: false },
    dismissal: {
      kind: String,
      bowlerName: String,
      fielderName: String,
      overNumber: Number
    },
    dotBalls: { type: Number, default: 0 },
    singles: { type: Number, default: 0 },
    twos: { type: Number, default: 0 },
    threes: { type: Number, default: 0 },
    powerplayRuns: { type: Number, default: 0 },
    middleOversRuns: { type: Number, default: 0 },
    deathOversRuns: { type: Number, default: 0 }
  }],

  // ========== BOWLER STATISTICS ==========
  bowlerStats: [{
    name: { type: String, required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inning: { type: Number, enum: [1, 2] },
    overs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    economy: { type: Number, default: 0 },
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    dotBalls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    currentSpell: {
      overs: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 }
    }
  }],

  // ========== FALL OF WICKETS ==========
  fallOfWickets: [{
    wicketNumber: Number,
    inning: { type: Number, enum: [1, 2] },
    playerOut: String,
    score: Number,
    overs: String,
    partnershipRuns: Number,
    dismissalType: String
  }],

  // ========== PARTNERSHIPS ==========
  partnerships: [{
    inning: { type: Number, enum: [1, 2] },
    wicket: Number,
    batsman1: String,
    batsman2: String,
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  }],

  // ========== OVER SUMMARY ==========
  overSummary: [{
    inning: { type: Number, enum: [1, 2] },
    overNumber: Number,
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    bowlerName: String,
    extras: { type: Number, default: 0 },
    runRate: Number
  }],

  // ========== MATCH ANALYTICS ==========
  analytics: {
    powerplayPhase: {
      overs: String,
      runsScored: Number,
      wicketsLost: Number,
      runRate: Number
    },
    middleOvers: {
      overs: String,
      runsScored: Number,
      wicketsLost: Number,
      runRate: Number
    },
    deathOvers: {
      overs: String,
      runsScored: Number,
      wicketsLost: Number,
      runRate: Number
    },
    turningPoints: [{
      description: String,
      overNumber: Number,
      ballNumber: Number
    }],
    milestones: [{
      type: {
        type: String,
        enum: ["fifty", "century", "5_wickets", "10_wickets", "team_100", "team_200"]
      },
      playerName: String,
      overNumber: Number,
      timestamp: Date
    }]
  },

  // ========== MEDIA ==========
  media: {
    hasLiveStream: { type: Boolean, default: false },
    streamUrl: String,
    streamProvider: String,
    highlights: [{
      title: String,
      description: String,
      ballNumber: Number,
      videoUrl: String,
      thumbnailUrl: String,
      priority: Number,
      timestamp: Date
    }],
    images: [String]
  },

  // ========== SOCIAL & ENGAGEMENT ==========
  engagement: {
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      text: String,
      timestamp: { type: Date, default: Date.now }
    }],
    shares: { type: Number, default: 0 }
  },

  // ========== MAN OF THE MATCH ==========
  manOfTheMatch: {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    playerName: String,
    performance: String
  },

  // ========== MATCH OFFICIALS ==========
  officials: {
    umpire1: String,
    umpire2: String,
    thirdUmpire: String,
    matchReferee: String,
    scorer: String
  },

  // ========== CONDITIONS ==========
  conditions: {
    weather: String,
    pitchType: {
      type: String,
      enum: ["green", "dry", "dusty", "normal"]
    },
    tossAdvantage: String
  }

}, {
  timestamps: true
});

// ========== INDEXES ==========
matchSchema.index({ status: 1, matchDate: -1 });
matchSchema.index({ createdBy: 1 });
matchSchema.index({ tournament: 1 });
matchSchema.index({ "teamA.playerLinks.userId": 1 });
matchSchema.index({ "teamB.playerLinks.userId": 1 });

// ========== VIRTUAL FIELDS ==========
matchSchema.virtual("isLive").get(function () {
  return this.status === "live";
});

matchSchema.virtual("totalBalls").get(function () {
  return this.ballByBallData.filter((b) => !b.isReverted).length;
});

// ========== METHODS ==========
matchSchema.methods.calculateRunRate = function (inning) {
  const innings = inning === 1 ? this.innings.first : this.innings.second;
  const totalBalls = (innings.overs || 0) * 6 + (innings.balls || 0);
  if (totalBalls === 0) return 0;
  return ((innings.score / totalBalls) * 6).toFixed(2);
};

matchSchema.methods.calculateRequiredRunRate = function () {
  if (this.currentInning !== 2) return 0;
  const second = this.innings.second;
  const remainingRuns = (second.target || 0) - (second.score || 0);
  const totalOversVal = this.totalOvers || this.oversLimit || 20;
  const remainingBalls = (totalOversVal * 6) - ((second.overs || 0) * 6 + (second.balls || 0));
  if (remainingBalls <= 0) return 0;
  return ((remainingRuns / remainingBalls) * 6).toFixed(2);
};

matchSchema.methods.getCurrentScore = function () {
  const inning = this.currentInning === 1 ? this.innings.first : this.innings.second;
  return `${inning.score}/${inning.wickets} (${inning.overs}.${inning.balls})`;
};

// ========== STATIC METHODS ==========
matchSchema.statics.getLiveMatches = function () {
  return this.find({ status: "live" })
    .populate("createdBy", "name email")
    .populate("tournament", "name")
    .sort({ matchDate: -1 });
};

matchSchema.statics.getUpcomingMatches = function () {
  return this.find({
    status: { $in: ["scheduled", "upcoming"] },
    matchDate: { $gte: new Date() }
  })
    .populate("createdBy", "name email")
    .populate("tournament", "name")
    .sort({ matchDate: 1 });
};

module.exports = mongoose.model("Match", matchSchema);
