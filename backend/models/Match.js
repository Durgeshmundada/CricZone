// backend/models/Match.js
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  // ========== BASIC MATCH INFO ==========
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
  
  // ========== TEAM INFORMATION ==========
  teamA: {
    name: { type: String, required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    players: [String],
    playerLinks: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    players: [String],
    playerLinks: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    required: true
  },
  matchDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'upcoming', 'live', 'innings_break', 'completed', 'abandoned'],
    default: 'scheduled'
  },
  winner: {
    type: String,
    default: null
  },
  resultType: {
    type: String,
    enum: ['runs', 'wickets', 'tie', 'no_result', 'abandoned'],
    default: null
  },
  resultMargin: {
    type: Number,
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
  
  // ========== TOSS INFORMATION ==========
  toss: {
    winner: String,
    decision: {
      type: String,
      enum: ['bat', 'bowl']
    }
  },
  
  // ========== CURRENT MATCH STATE ==========
  currentInning: {
    type: Number,
    default: 1,
    enum: [1, 2]
  },
  currentStriker: String,
  currentStrikerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  currentNonStriker: String,
  currentNonStrikerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  currentBowler: String,
  currentBowlerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  currentOver: {
    overNumber: { type: Number, default: 0 },
    ballNumber: { type: Number, default: 0 } // 0-5 for 6-ball over
  },

  statsProcessed: {
    type: Boolean,
    default: false
  },
  
  // ========== INNINGS TRACKING (CricHero Style) ==========
  innings: {
    first: {
      battingTeam: String,
      bowlingTeam: String,
      score: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      isCompleted: { type: Boolean, default: false },
      
      // Extras breakdown
      extras: {
        total: { type: Number, default: 0 },
        wides: { type: Number, default: 0 },
        noBalls: { type: Number, default: 0 },
        byes: { type: Number, default: 0 },
        legByes: { type: Number, default: 0 },
        penalties: { type: Number, default: 0 }
      },
      
      // Run rate metrics
      runRate: { type: Number, default: 0 },
      requiredRunRate: { type: Number, default: 0 },
      
      // Powerplay tracking
      powerplay: {
        overs: { type: Number, default: 6 },
        runs: { type: Number, default: 0 },
        wickets: { type: Number, default: 0 }
      },
      
      // Partnership tracking
      currentPartnership: {
        runs: { type: Number, default: 0 },
        balls: { type: Number, default: 0 },
        batsman1: String,
        batsman2: String
      }
    },
    
    second: {
      battingTeam: String,
      bowlingTeam: String,
      score: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      isCompleted: { type: Boolean, default: false },
      target: { type: Number, default: 0 },
      
      extras: {
        total: { type: Number, default: 0 },
        wides: { type: Number, default: 0 },
        noBalls: { type: Number, default: 0 },
        byes: { type: Number, default: 0 },
        legByes: { type: Number, default: 0 },
        penalties: { type: Number, default: 0 }
      },
      
      runRate: { type: Number, default: 0 },
      requiredRunRate: { type: Number, default: 0 },
      
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
  
  // ========== BALL-BY-BALL DATA (Core Scoring Engine) ==========
  ballByBallData: [{
    // Ball identification
    ballNumber: { type: Number, required: true }, // Global ball number (0, 1, 2...)
    inning: { type: Number, enum: [1, 2], required: true },
    over: { type: Number, required: true }, // Over number (0, 1, 2...)
    ballInOver: { type: Number, required: true }, // 0-5 for 6-ball over
    isLegalDelivery: { type: Boolean, default: true }, // false for wide/noball
    
    // Players involved
    batsmanName: { type: String, required: true },
    batsmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nonStrikerName: String,
    bowlerName: { type: String, required: true },
    bowlerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Runs scored
    runs: { type: Number, default: 0, min: 0, max: 6 },
    totalRuns: { type: Number, default: 0 }, // runs + extras
    batsmanRuns: { type: Number, default: 0 },
    
    // Extras
    extras: {
      total: { type: Number, default: 0 },
      type: {
        type: String,
        enum: ['wide', 'noball', 'bye', 'legbye', 'penalty', 'none'],
        default: 'none'
      },
      runs: { type: Number, default: 0 }
    },
    
    // Wicket information
    isWicket: { type: Boolean, default: false },
    wicket: {
      playerOutName: String,
      playerOutId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      kind: {
        type: String,
        enum: ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 
               'caught_and_bowled', 'retired_hurt', 'timed_out', 'obstructing_field']
      },
      fielderName: String,
      fielderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    
    // Shot analysis (for wagon wheel & analytics)
    shot: {
      type: {
        type: String,
        enum: ['drive', 'cut', 'pull', 'sweep', 'flick', 'push', 'defense', 
               'loft', 'late_cut', 'hook', 'glance', 'reverse_sweep', 'other']
      },
      timing: {
        type: String,
        enum: ['perfect', 'good', 'edge', 'mistimed']
      }
    },
    
    // Ball tracking (for wagon wheel visualization)
    wagonWheel: {
      angle: Number, // 0-360 degrees
      distance: Number, // meters
      x: Number, // coordinate for plotting
      y: Number // coordinate for plotting
    },
    
    // Bowling analysis
    bowlingSpeed: Number, // km/h
    pitchMap: {
      length: {
        type: String,
        enum: ['full', 'yorker', 'good_length', 'short', 'bouncer']
      },
      line: {
        type: String,
        enum: ['off_stump', 'middle_stump', 'leg_stump', 'wide_outside_off', 'down_leg']
      }
    },
    
    // Commentary & highlights
    commentary: String,
    isHighlight: { type: Boolean, default: false },
    highlightPriority: { type: Number, min: 0, max: 10, default: 0 },
    
    // Metadata
    timestamp: { type: Date, default: Date.now },
    isReverted: { type: Boolean, default: false }, // For undo functionality
    revertedAt: Date
  }],
  
  // ========== BATSMAN STATISTICS ==========
  batsmanStats: [{
    name: { type: String, required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    
    // Advanced stats
    dotBalls: { type: Number, default: 0 },
    singles: { type: Number, default: 0 },
    twos: { type: Number, default: 0 },
    threes: { type: Number, default: 0 },
    
    // Phase-wise breakdown
    powerplayRuns: { type: Number, default: 0 },
    middleOversRuns: { type: Number, default: 0 },
    deathOversRuns: { type: Number, default: 0 }
  }],
  
  // ========== BOWLER STATISTICS ==========
  bowlerStats: [{
    name: { type: String, required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inning: { type: Number, enum: [1, 2] },
    
    overs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    economy: { type: Number, default: 0 },
    
    // Extras conceded
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    
    // Advanced stats
    dotBalls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    
    // Current spell
    currentSpell: {
      overs: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 }
    }
  }],
  
  // ========== FALL OF WICKETS ==========
  fallOfWickets: [{
    wicketNumber: Number, // 1st wicket, 2nd wicket, etc.
    inning: { type: Number, enum: [1, 2] },
    playerOut: String,
    score: Number, // Team score when wicket fell
    overs: String, // "12.4"
    partnershipRuns: Number,
    dismissalType: String
  }],
  
  // ========== PARTNERSHIPS ==========
  partnerships: [{
    inning: { type: Number, enum: [1, 2] },
    wicket: Number, // 1st wicket partnership, 2nd wicket, etc.
    batsman1: String,
    batsman2: String,
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  }],
  
  // ========== OVER SUMMARY (for Manhattan chart) ==========
  overSummary: [{
    inning: { type: Number, enum: [1, 2] },
    overNumber: Number,
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    bowlerName: String,
    extras: { type: Number, default: 0 },
    runRate: Number
  }],
  
  // ========== MATCH INSIGHTS & ANALYTICS ==========
  analytics: {
    // Phase-wise analysis
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
    
    // Key moments
    turningPoints: [{
      description: String,
      overNumber: Number,
      ballNumber: Number
    }],
    
    // Performance milestones
    milestones: [{
      type: {
        type: String,
        enum: ['fifty', 'century', '5_wickets', '10_wickets', 'team_100', 'team_200']
      },
      playerName: String,
      overNumber: Number,
      timestamp: Date
    }]
  },
  
  // ========== STREAMING & MEDIA ==========
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
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: String,
      timestamp: { type: Date, default: Date.now }
    }],
    shares: { type: Number, default: 0 }
  },
  
  // ========== MAN OF THE MATCH ==========
  manOfTheMatch: {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
  
  // ========== WEATHER & CONDITIONS ==========
  conditions: {
    weather: String,
    pitchType: {
      type: String,
      enum: ['green', 'dry', 'dusty', 'normal']
    },
    tossAdvantage: String
  }
  
}, {
  timestamps: true, // Adds createdAt and updatedAt
  
  // Index for performance
  index: {
    status: 1,
    matchDate: -1,
    tournament: 1
  }
});

// ========== INDEXES FOR PERFORMANCE ==========
matchSchema.index({ status: 1, matchDate: -1 });
matchSchema.index({ 'createdBy': 1 });
matchSchema.index({ 'tournament': 1 });
matchSchema.index({ 'teamA.playerLinks.userId': 1 });
matchSchema.index({ 'teamB.playerLinks.userId': 1 });
matchSchema.index({ 'ballByBallData.inning': 1, 'ballByBallData.over': 1 });

// ========== VIRTUAL FIELDS ==========
matchSchema.virtual('isLive').get(function() {
  return this.status === 'live';
});

matchSchema.virtual('totalBalls').get(function() {
  return this.ballByBallData.filter(b => !b.isReverted).length;
});

// ========== METHODS ==========
matchSchema.methods.calculateRunRate = function(inning) {
  const innings = inning === 1 ? this.innings.first : this.innings.second;
  const totalBalls = innings.overs * 6 + innings.balls;
  if (totalBalls === 0) return 0;
  return ((innings.score / totalBalls) * 6).toFixed(2);
};

matchSchema.methods.calculateRequiredRunRate = function() {
  if (this.currentInning !== 2) return 0;
  const second = this.innings.second;
  const remainingRuns = second.target - second.score;
  const remainingBalls = (this.totalOvers * 6) - (second.overs * 6 + second.balls);
  if (remainingBalls <= 0) return 0;
  return ((remainingRuns / remainingBalls) * 6).toFixed(2);
};

matchSchema.methods.getCurrentScore = function() {
  const inning = this.currentInning === 1 ? this.innings.first : this.innings.second;
  return `${inning.score}/${inning.wickets} (${inning.overs}.${inning.balls})`;
};

// ========== STATIC METHODS ==========
matchSchema.statics.getLiveMatches = function() {
  return this.find({ status: 'live' })
    .populate('createdBy', 'name email')
    .populate('tournament', 'name')
    .sort({ matchDate: -1 });
};

matchSchema.statics.getUpcomingMatches = function() {
  return this.find({ 
    status: { $in: ['scheduled', 'upcoming'] },
    matchDate: { $gte: new Date() }
  })
    .populate('createdBy', 'name email')
    .populate('tournament', 'name')
    .sort({ matchDate: 1 });
};

module.exports = mongoose.model('Match', matchSchema);
