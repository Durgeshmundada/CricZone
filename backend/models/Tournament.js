// backend/models/Tournament.js
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
    maxlength: 10 // e.g., "IPL25", "WC23"
  },
  logo: {
    type: String, // URL to tournament logo
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
    required: true
  },
  
  // ========== VENUE INFORMATION ==========
  venue: {
    type: String,
    required: true
  },
  venues: [{
    name: String,
    location: String,
    capacity: Number,
    pitchType: {
      type: String,
      enum: ['batting_friendly', 'bowling_friendly', 'balanced']
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
    enum: ['league', 'knockout', 'league_knockout', 'group_stage'],
    default: 'league_knockout',
    required: true
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
    min: 7
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
      required: true
    },
    captain: String,
    viceCaptain: String,
    wicketkeeper: String,
    coach: String,
    
    players: [{
      name: String,
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      role: {
        type: String,
        enum: ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper']
      },
      jerseyNumber: Number
    }],
    
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
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
    
    // Group assignment (for group stage tournaments)
    group: {
      type: String,
      enum: ['A', 'B', 'C', 'D']
    }
  }],
  
  // ========== TOURNAMENT STATUS ==========
  status: {
    type: String,
    enum: ["upcoming", "registration_open", "registration_closed", "ongoing", "playoffs", "completed", "cancelled"],
    default: "upcoming"
  },
  
  // ========== POINTS SYSTEM (IPL Style) ==========
  pointsSystem: {
    win: { type: Number, default: 2 },
    loss: { type: Number, default: 0 },
    tie: { type: Number, default: 1 },
    noResult: { type: Number, default: 1 },
    superOver: { type: Boolean, default: true },
    bonusPoint: { type: Boolean, default: false }, // For special conditions
    bonusPointCriteria: String
  },
  
  // ========== LEAGUE STANDINGS / POINTS TABLE ==========
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
    
    // Net Run Rate calculation
    netRunRate: { type: Number, default: 0.0 },
    runsScored: { type: Number, default: 0 },
    oversPlayed: { type: Number, default: 0 },
    runsConceded: { type: Number, default: 0 },
    oversBowled: { type: Number, default: 0 },
    
    // Recent form (last 5 matches: W/L/T/NR)
    form: [String], // ["W", "L", "W", "W", "NR"]
    
    // Group (for group stage tournaments)
    group: String
  }],
  
  // ========== MATCH SCHEDULE ==========
  schedule: [{
    round: String, // "Round 1", "Semi-Final", "Final"
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
      enum: ['scheduled', 'live', 'completed', 'postponed', 'cancelled'],
      default: 'scheduled'
    },
    result: {
      winner: String,
      margin: String,
      type: String // "by 5 wickets", "by 20 runs"
    }
  }],
  
  // ========== GROUP STAGE CONFIGURATION ==========
  groups: [{
    name: {
      type: String,
      enum: ['A', 'B', 'C', 'D']
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
      default: 2 // Top 2 from each group qualify
    }
  }],
  
  // ========== KNOCKOUT BRACKET (IPL/World Cup Style) ==========
  knockout: {
    // Playoff structure
    playoffFormat: {
      type: String,
      enum: ['standard', 'ipl_style', 'direct_final'],
      default: 'ipl_style'
      // IPL: Q1, Eliminator, Q2, Final
      // Standard: SF1, SF2, Final
    },
    
    // Qualifier 1 (1st vs 2nd)
    qualifier1: {
      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      },
      team1: String, // 1st place team
      team2: String, // 2nd place team
      winner: String,
      loser: String,
      venue: String,
      date: Date
    },
    
    // Eliminator (3rd vs 4th)
    eliminator: {
      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      },
      team1: String, // 3rd place team
      team2: String, // 4th place team
      winner: String,
      loser: String,
      venue: String,
      date: Date
    },
    
    // Qualifier 2 (Loser of Q1 vs Winner of Eliminator)
    qualifier2: {
      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      },
      team1: String, // Loser of Q1
      team2: String, // Winner of Eliminator
      winner: String,
      loser: String,
      venue: String,
      date: Date
    },
    
    // Semi-Finals (for standard format)
    semiFinals: [{
      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      },
      team1: String,
      team2: String,
      winner: String,
      venue: String,
      date: Date
    }],
    
    // Final
    final: {
      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      },
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
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team"
    }
  },
  runnerUp: {
    teamName: String,
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team"
    }
  },
  
  // ========== AWARDS & RECOGNITIONS ==========
  awards: {
    playerOfTheTournament: {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      playerName: String,
      performance: String
    },
    
    orangeCap: {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      playerName: String,
      runs: Number
    },
    
    purpleCap: {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      playerName: String,
      wickets: Number
    },
    
    bestBatsman: {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      playerName: String,
      stats: String
    },
    
    bestBowler: {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      playerName: String,
      stats: String
    },
    
    fairPlayAward: {
      teamName: String,
      points: Number
    },
    
    emergingPlayer: {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      playerName: String
    }
  },
  
  // ========== PRIZE & SPONSORSHIP ==========
  prizePool: {
    total: String,
    winner: String,
    runnerUp: String,
    playerOfTournament: String,
    currency: {
      type: String,
      default: "INR"
    }
  },
  
  sponsors: [{
    name: String,
    logo: String,
    type: {
      type: String,
      enum: ['title', 'associate', 'official']
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
      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      }
    },
    
    lowestScore: {
      runs: Number,
      team: String,
      against: String,
      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      }
    },
    
    highestIndividualScore: {
      runs: Number,
      playerName: String,
      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      }
    },
    
    bestBowlingFigures: {
      wickets: Number,
      runs: Number,
      playerName: String,
      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      }
    }
  },
  
  // ========== RULES & REGULATIONS ==========
  rules: {
    oversPerInning: Number,
    powerplayOvers: { type: Number, default: 6 },
    drsAvailable: { type: Boolean, default: false },
    maxOversPerBowler: Number,
    playerSubstitutions: { type: Boolean, default: false },
    superOverInCase: {
      type: String,
      enum: ['tie', 'no_result', 'none'],
      default: 'tie'
    }
  },
  
  // ========== TOURNAMENT ADMINS ==========
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  organizers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    name: String,
    role: {
      type: String,
      enum: ['admin', 'moderator', 'scorer']
    }
  }],
  
  // ========== MEDIA & ENGAGEMENT ==========
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
  
  // ========== LIVE FEATURES ==========
  live: {
    isLive: { type: Boolean, default: false },
    currentMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match"
    },
    viewers: { type: Number, default: 0 }
  },
  
  // ========== ENTRY FEES & REGISTRATION ==========
  registration: {
    entryFee: {
      amount: Number,
      currency: {
        type: String,
        default: "INR"
      }
    },
    isOpen: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: false }
  }
  
}, {
  timestamps: true
});

// ========== INDEXES FOR PERFORMANCE ==========
tournamentSchema.index({ status: 1, startDate: -1 });
tournamentSchema.index({ createdBy: 1 });
tournamentSchema.index({ 'registeredTeams.teamId': 1 });
tournamentSchema.index({ 'matches': 1 });

// ========== VIRTUAL FIELDS ==========
tournamentSchema.virtual('isActive').get(function() {
  return this.status === 'ongoing' || this.status === 'playoffs';
});

tournamentSchema.virtual('daysRemaining').get(function() {
  if (this.status === 'completed') return 0;
  const today = new Date();
  const diff = this.startDate - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

tournamentSchema.virtual('totalTeams').get(function() {
  return this.registeredTeams.length;
});

tournamentSchema.virtual('isFull').get(function() {
  return this.registeredTeams.length >= this.maxTeams;
});

// ========== METHODS ==========

// Update standings after a match
tournamentSchema.methods.updateStandings = function(matchResult) {
  const { teamA, teamB, winner, runsScored, runsConceded, overs } = matchResult;
  
  // Find teams in standings
  let teamAStanding = this.standings.find(s => s.teamName === teamA);
  let teamBStanding = this.standings.find(s => s.teamName === teamB);
  
  // Update match played
  teamAStanding.played++;
  teamBStanding.played++;
  
  // Update wins/losses
  if (winner === teamA) {
    teamAStanding.won++;
    teamAStanding.points += this.pointsSystem.win;
    teamBStanding.lost++;
    teamAStanding.form.push('W');
    teamBStanding.form.push('L');
  } else if (winner === teamB) {
    teamBStanding.won++;
    teamBStanding.points += this.pointsSystem.win;
    teamAStanding.lost++;
    teamBStanding.form.push('W');
    teamAStanding.form.push('L');
  } else {
    // Tie or No Result
    teamAStanding.tied++;
    teamBStanding.tied++;
    teamAStanding.points += this.pointsSystem.tie;
    teamBStanding.points += this.pointsSystem.tie;
    teamAStanding.form.push('T');
    teamBStanding.form.push('T');
  }
  
  // Keep only last 5 form results
  if (teamAStanding.form.length > 5) teamAStanding.form.shift();
  if (teamBStanding.form.length > 5) teamBStanding.form.shift();
  
  // Update NRR
  this.calculateNRR(teamAStanding);
  this.calculateNRR(teamBStanding);
  
  // Sort standings by points, then NRR
  this.standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.netRunRate - a.netRunRate;
  });
  
  // Update positions
  this.standings.forEach((team, index) => {
    team.position = index + 1;
  });
};

// Calculate Net Run Rate
tournamentSchema.methods.calculateNRR = function(teamStanding) {
  const runRate = teamStanding.oversPlayed > 0 
    ? teamStanding.runsScored / teamStanding.oversPlayed 
    : 0;
  const concededRate = teamStanding.oversBowled > 0 
    ? teamStanding.runsConceded / teamStanding.oversBowled 
    : 0;
  
  teamStanding.netRunRate = parseFloat((runRate - concededRate).toFixed(3));
};

// Generate playoff bracket
tournamentSchema.methods.generatePlayoffs = function() {
  if (this.standings.length < 4) {
    throw new Error('Need at least 4 teams for playoffs');
  }
  
  const top4 = this.standings.slice(0, 4);
  
  if (this.knockout.playoffFormat === 'ipl_style') {
    // Qualifier 1: 1st vs 2nd
    this.knockout.qualifier1.team1 = top4[0].teamName;
    this.knockout.qualifier1.team2 = top4[1].teamName;
    
    // Eliminator: 3rd vs 4th
    this.knockout.eliminator.team1 = top4[2].teamName;
    this.knockout.eliminator.team2 = top4[3].teamName;
  } else {
    // Standard: SF1 (1 vs 4), SF2 (2 vs 3)
    this.knockout.semiFinals = [
      { team1: top4[0].teamName, team2: top4[3].teamName },
      { team1: top4[1].teamName, team2: top4[2].teamName }
    ];
  }
};

// Auto-generate league fixtures (round-robin)
tournamentSchema.methods.generateLeagueFixtures = function() {
  const teams = this.registeredTeams.map(t => t.teamName);
  const fixtures = [];
  let matchNumber = 1;
  
  // Round-robin: each team plays every other team
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      fixtures.push({
        round: `Match ${matchNumber}`,
        matchNumber: matchNumber++,
        teamA: teams[i],
        teamB: teams[j],
        venue: this.venues[Math.floor(Math.random() * this.venues.length)]?.name || this.venue,
        status: 'scheduled'
      });
    }
  }
  
  this.schedule = fixtures;
  return fixtures;
};

// ========== STATIC METHODS ==========

// Get active tournaments
tournamentSchema.statics.getActiveTournaments = function() {
  return this.find({ 
    status: { $in: ['registration_open', 'ongoing', 'playoffs'] } 
  })
    .populate('createdBy', 'name email')
    .sort({ startDate: 1 });
};

// Get upcoming tournaments
tournamentSchema.statics.getUpcomingTournaments = function() {
  return this.find({ 
    status: 'upcoming',
    startDate: { $gte: new Date() }
  })
    .populate('createdBy', 'name email')
    .sort({ startDate: 1 });
};

module.exports = mongoose.model("Tournament", tournamentSchema);
