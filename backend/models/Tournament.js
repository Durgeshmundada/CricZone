const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema({
  // ========== BASIC TOURNAMENT INFO ==========
  name: {
    type: String,
    required: [true, "Tournament name is required"],
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  shortName: {
    type: String,
    trim: true,
    maxlength: 10
  },
  logo: {
    type: String,
    default: ""
  },

  // ========== TOURNAMENT DATES ==========
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  registrationDeadline: {
    type: Date,
    default: null
  },

  // ========== VENUE INFORMATION ==========
  venue: {
    type: String,
    required: true,
    trim: true
  },
  venues: [{
    name: String,
    location: String,
    capacity: Number,
    pitchType: {
      type: String,
      enum: ["batting_friendly", "bowling_friendly", "balanced"]
    }
  }],

  // ========== TOURNAMENT FORMAT ==========
  format: {
    type: String,
    enum: ["T20", "ODI", "Test", "Custom"],
    default: "T20"
  },
  customOvers: {
    type: Number,
    min: 1,
    max: 50
  },

  // ========== TOURNAMENT TYPE & STRUCTURE ==========
  tournamentType: {
    type: String,
    enum: ["league", "knockout", "league_knockout", "group_stage"],
    default: "league_knockout"
  },

  // ========== TEAM MANAGEMENT ==========
  maxTeams: {
    type: Number,
    default: 8,
    min: 2,
    max: 20
  },
  minPlayers: {
    type: Number,
    default: 11,
    min: 2
  },
  maxPlayers: {
    type: Number,
    default: 15,
    max: 20
  },

  registeredTeams: [{
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team"
    },
    teamName: {
      type: String,
      required: true,
      trim: true
    },
    captain: { type: String, default: "", trim: true },
    viceCaptain: { type: String, default: "", trim: true },
    wicketkeeper: { type: String, default: "", trim: true },
    coach: { type: String, default: "", trim: true },

    players: [{
      name: { type: String, required: true, trim: true },
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      role: {
        type: String,
        enum: ["Batsman", "Bowler", "All-rounder", "Wicket-keeper"]
      },
      jerseyNumber: Number
    }],

    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },

    // Team stats in tournament
    stats: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 },
      lost: { type: Number, default: 0 },
      tied: { type: Number, default: 0 },
      noResult: { type: Number, default: 0 },
      points: { type: Number, default: 0 },
      netRunRate: { type: Number, default: 0.0 }
    },

    group: {
      type: String,
      enum: ["A", "B", "C", "D"]
    }
  }],

  // ========== TOURNAMENT STATUS ==========
  status: {
    type: String,
    enum: ["upcoming", "registration_open", "registration_closed", "ongoing", "playoffs", "completed", "cancelled"],
    default: "upcoming"
  },

  // ========== POINTS SYSTEM ==========
  pointsSystem: {
    win: { type: Number, default: 2 },
    loss: { type: Number, default: 0 },
    tie: { type: Number, default: 1 },
    noResult: { type: Number, default: 1 },
    superOver: { type: Boolean, default: true },
    bonusPoint: { type: Boolean, default: false },
    bonusPointCriteria: String
  },

  // ========== LEAGUE STANDINGS ==========
  standings: [{
    teamName: String,
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team"
    },
    position: Number,
    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    tied: { type: Number, default: 0 },
    noResult: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    netRunRate: { type: Number, default: 0.0 },
    runsScored: { type: Number, default: 0 },
    oversPlayed: { type: Number, default: 0 },
    runsConceded: { type: Number, default: 0 },
    oversBowled: { type: Number, default: 0 },
    form: [String],
    group: String
  }],

  // ========== MATCH SCHEDULE ==========
  schedule: [{
    round: String,
    matchNumber: Number,
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match"
    },
    teamA: String,
    teamB: String,
    venue: String,
    date: Date,
    time: String,
    status: {
      type: String,
      enum: ["scheduled", "live", "completed", "postponed", "cancelled"],
      default: "scheduled"
    },
    result: {
      winner: String,
      margin: String,
      type: String
    }
  }],

  // ========== GROUP STAGE CONFIGURATION ==========
  groups: [{
    name: {
      type: String,
      enum: ["A", "B", "C", "D"]
    },
    teams: [String],
    standings: [{
      teamName: String,
      played: Number,
      won: Number,
      lost: Number,
      points: Number,
      netRunRate: Number
    }],
    qualifiersCount: {
      type: Number,
      default: 2
    }
  }],

  // ========== KNOCKOUT BRACKET ==========
  knockout: {
    playoffFormat: {
      type: String,
      enum: ["standard", "ipl_style", "direct_final"],
      default: "ipl_style"
    },
    qualifier1: {
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
      team1: String,
      team2: String,
      winner: String,
      loser: String,
      venue: String,
      date: Date
    },
    eliminator: {
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
      team1: String,
      team2: String,
      winner: String,
      loser: String,
      venue: String,
      date: Date
    },
    qualifier2: {
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
      team1: String,
      team2: String,
      winner: String,
      loser: String,
      venue: String,
      date: Date
    },
    semiFinals: [{
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
      team1: String,
      team2: String,
      winner: String,
      venue: String,
      date: Date
    }],
    final: {
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
      team1: String,
      team2: String,
      winner: String,
      runnerUp: String,
      venue: String,
      date: Date,
      manOfTheMatch: String,
      margin: String
    }
  },

  // ========== MATCHES REFERENCE ==========
  matches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Match"
  }],

  // ========== TOURNAMENT RESULTS ==========
  winner: {
    teamName: String,
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" }
  },
  runnerUp: {
    teamName: String,
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" }
  },

  // ========== AWARDS ==========
  awards: {
    playerOfTheTournament: {
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      playerName: String,
      performance: String
    },
    orangeCap: {
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      playerName: String,
      runs: Number
    },
    purpleCap: {
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      playerName: String,
      wickets: Number
    },
    bestBatsman: {
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      playerName: String,
      stats: String
    },
    bestBowler: {
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      playerName: String,
      stats: String
    },
    fairPlayAward: { teamName: String, points: Number },
    emergingPlayer: {
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      playerName: String
    }
  },

  // ========== PRIZE & SPONSORSHIP ==========
  prizePool: {
    total: String,
    winner: String,
    runnerUp: String,
    playerOfTournament: String,
    currency: { type: String, default: "INR" }
  },

  sponsors: [{
    name: String,
    logo: String,
    type: {
      type: String,
      enum: ["title", "associate", "official"]
    }
  }],

  // ========== TOURNAMENT STATISTICS ==========
  statistics: {
    totalMatches: { type: Number, default: 0 },
    completedMatches: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    totalWickets: { type: Number, default: 0 },
    totalFours: { type: Number, default: 0 },
    totalSixes: { type: Number, default: 0 },
    highestScore: {
      runs: Number,
      team: String,
      against: String,
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" }
    },
    lowestScore: {
      runs: Number,
      team: String,
      against: String,
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" }
    },
    highestIndividualScore: {
      runs: Number,
      playerName: String,
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" }
    },
    bestBowlingFigures: {
      wickets: Number,
      runs: Number,
      playerName: String,
      matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" }
    }
  },

  // ========== RULES ==========
  rules: {
    oversPerInning: Number,
    powerplayOvers: { type: Number, default: 6 },
    drsAvailable: { type: Boolean, default: false },
    maxOversPerBowler: Number,
    playerSubstitutions: { type: Boolean, default: false },
    superOverInCase: {
      type: String,
      enum: ["tie", "no_result", "none"],
      default: "tie"
    }
  },

  // ========== TOURNAMENT ADMINS ==========
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  organizers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    role: {
      type: String,
      enum: ["admin", "moderator", "scorer"]
    }
  }],

  // ========== MEDIA ==========
  media: {
    bannerImage: String,
    videos: [String],
    gallery: [String]
  },
  social: {
    hashtag: String,
    officialWebsite: String,
    broadcastPartners: [String]
  },
  live: {
    isLive: { type: Boolean, default: false },
    currentMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
    viewers: { type: Number, default: 0 }
  },

  // ========== REGISTRATION ==========
  registration: {
    entryFee: {
      amount: Number,
      currency: { type: String, default: "INR" }
    },
    isOpen: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: false }
  }

}, {
  timestamps: true
});

// ========== INDEXES ==========
tournamentSchema.index({ status: 1, startDate: -1 });
tournamentSchema.index({ createdBy: 1 });
tournamentSchema.index({ "registeredTeams.teamId": 1 });
tournamentSchema.index({ matches: 1 });

// ========== VIRTUAL FIELDS ==========
tournamentSchema.virtual("isActive").get(function () {
  return this.status === "ongoing" || this.status === "playoffs";
});

tournamentSchema.virtual("daysRemaining").get(function () {
  if (this.status === "completed") return 0;
  const today = new Date();
  const diff = this.startDate - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

tournamentSchema.virtual("totalTeams").get(function () {
  return this.registeredTeams.length;
});

tournamentSchema.virtual("isFull").get(function () {
  return this.registeredTeams.length >= this.maxTeams;
});

// ========== METHODS ==========

tournamentSchema.methods.updateStandings = function (matchResult) {
  const { teamA, teamB, winner } = matchResult;

  let teamAStanding = this.standings.find((s) => s.teamName === teamA);
  let teamBStanding = this.standings.find((s) => s.teamName === teamB);

  if (!teamAStanding || !teamBStanding) return;

  teamAStanding.played++;
  teamBStanding.played++;

  if (winner === teamA) {
    teamAStanding.won++;
    teamAStanding.points += this.pointsSystem.win;
    teamBStanding.lost++;
    teamAStanding.form.push("W");
    teamBStanding.form.push("L");
  } else if (winner === teamB) {
    teamBStanding.won++;
    teamBStanding.points += this.pointsSystem.win;
    teamAStanding.lost++;
    teamBStanding.form.push("W");
    teamAStanding.form.push("L");
  } else {
    teamAStanding.tied++;
    teamBStanding.tied++;
    teamAStanding.points += this.pointsSystem.tie;
    teamBStanding.points += this.pointsSystem.tie;
    teamAStanding.form.push("T");
    teamBStanding.form.push("T");
  }

  if (teamAStanding.form.length > 5) teamAStanding.form.shift();
  if (teamBStanding.form.length > 5) teamBStanding.form.shift();

  this.calculateNRR(teamAStanding);
  this.calculateNRR(teamBStanding);

  this.standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.netRunRate - a.netRunRate;
  });

  this.standings.forEach((team, index) => {
    team.position = index + 1;
  });
};

tournamentSchema.methods.calculateNRR = function (teamStanding) {
  const runRate = teamStanding.oversPlayed > 0
    ? teamStanding.runsScored / teamStanding.oversPlayed
    : 0;
  const concededRate = teamStanding.oversBowled > 0
    ? teamStanding.runsConceded / teamStanding.oversBowled
    : 0;

  teamStanding.netRunRate = parseFloat((runRate - concededRate).toFixed(3));
};

tournamentSchema.methods.generatePlayoffs = function () {
  if (this.standings.length < 4) {
    throw new Error("Need at least 4 teams for playoffs");
  }

  const top4 = this.standings.slice(0, 4);

  if (this.knockout.playoffFormat === "ipl_style") {
    this.knockout.qualifier1.team1 = top4[0].teamName;
    this.knockout.qualifier1.team2 = top4[1].teamName;
    this.knockout.eliminator.team1 = top4[2].teamName;
    this.knockout.eliminator.team2 = top4[3].teamName;
  } else {
    this.knockout.semiFinals = [
      { team1: top4[0].teamName, team2: top4[3].teamName },
      { team1: top4[1].teamName, team2: top4[2].teamName }
    ];
  }
};

tournamentSchema.methods.generateLeagueFixtures = function () {
  const teams = this.registeredTeams.map((t) => t.teamName);
  const fixtures = [];
  let matchNumber = 1;

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      fixtures.push({
        round: `Match ${matchNumber}`,
        matchNumber: matchNumber++,
        teamA: teams[i],
        teamB: teams[j],
        venue: this.venues[Math.floor(Math.random() * this.venues.length)]?.name || this.venue,
        status: "scheduled"
      });
    }
  }

  this.schedule = fixtures;
  return fixtures;
};

// ========== STATIC METHODS ==========

tournamentSchema.statics.getActiveTournaments = function () {
  return this.find({
    status: { $in: ["registration_open", "ongoing", "playoffs"] }
  })
    .populate("createdBy", "name email")
    .sort({ startDate: 1 });
};

tournamentSchema.statics.getUpcomingTournaments = function () {
  return this.find({
    status: "upcoming",
    startDate: { $gte: new Date() }
  })
    .populate("createdBy", "name email")
    .sort({ startDate: 1 });
};

module.exports = mongoose.model("Tournament", tournamentSchema);
