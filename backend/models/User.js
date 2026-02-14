// backend/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  // ========== BASIC USER INFO ==========
  name: {
    type: String,
    required: [true, "Please provide your name"],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Please provide an email"],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"]
  },
  phone: {
    type: String,
    required: [true, "Please provide a phone number"],
    match: [/^[0-9]{10,15}$/, "Please enter a valid phone number"],
    unique: true
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: 6,
    select: false
  },
  
  // ========== USER ROLE & PERMISSIONS ==========
  role: {
    type: String,
    enum: ["admin", "user", "scorer", "organizer"],
    default: "user"
  },
  
  // ========== PLAYER PROFILE (Feature #9: Looking/Player Discovery) ==========
  profile: {
    // Basic Info
    displayName: String,
    bio: {
      type: String,
      maxlength: 500
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other']
    },
    
    // Location (for nearby player discovery)
    location: {
      city: String,
      state: String,
      country: {
        type: String,
        default: 'India'
      },
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    
    // Cricket Profile
    playerType: {
      type: String,
      enum: ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper', 'Not specified'],
      default: 'Not specified'
    },
    battingStyle: {
      type: String,
      enum: ['Right-hand', 'Left-hand', 'N/A'],
      default: 'N/A'
    },
    bowlingStyle: {
      type: String,
      enum: ['Fast', 'Fast-Medium', 'Medium', 'Medium-Slow', 'Spin', 'Off-Spin', 'Leg-Spin', 'N/A'],
      default: 'N/A'
    },
    
    // Availability & Preferences
    availability: {
      type: String,
      enum: ['Available', 'Unavailable', 'Looking for team', 'Looking for players'],
      default: 'Available'
    },
    preferredFormats: [{
      type: String,
      enum: ['T20', 'ODI', 'Test', 'Custom']
    }],
    experienceLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Professional'],
      default: 'Beginner'
    },
    
    // Jersey & Preferences
    jerseyNumber: {
      type: Number,
      min: 1,
      max: 99
    },
    preferredPosition: String,
    
    // Social Media
    social: {
      instagram: String,
      twitter: String,
      youtube: String
    }
  },
  
  // ========== PLAYER STATISTICS (Feature #6: Leaderboards) ==========
  stats: {
    // Overall Career Stats
    matchesPlayed: {
      type: Number,
      default: 0
    },
    wins: {
      type: Number,
      default: 0
    },
    losses: {
      type: Number,
      default: 0
    },
    ties: {
      type: Number,
      default: 0
    },
    
    // Batting Statistics
    batting: {
      innings: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      ballsFaced: { type: Number, default: 0 },
      highestScore: { type: Number, default: 0 },
      notOuts: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 },
      centuries: { type: Number, default: 0 },
      halfCenturies: { type: Number, default: 0 },
      fours: { type: Number, default: 0 },
      sixes: { type: Number, default: 0 },
      ducks: { type: Number, default: 0 }
    },
    
    // Bowling Statistics
    bowling: {
      innings: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      maidens: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      bestFigures: {
        wickets: { type: Number, default: 0 },
        runs: { type: Number, default: 0 }
      },
      average: { type: Number, default: 0 },
      economy: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 },
      fiveWickets: { type: Number, default: 0 },
      tenWickets: { type: Number, default: 0 }
    },
    
    // Fielding Statistics
    fielding: {
      catches: { type: Number, default: 0 },
      runOuts: { type: Number, default: 0 },
      stumpings: { type: Number, default: 0 }
    },
    
    // Awards & Achievements
    awards: {
      manOfTheMatch: { type: Number, default: 0 },
      orangeCaps: { type: Number, default: 0 },
      purpleCaps: { type: Number, default: 0 }
    }
  },
  
  // ========== FORMAT-WISE STATISTICS ==========
  formatStats: {
    T20: {
      matches: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 }
    },
    ODI: {
      matches: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 }
    },
    Test: {
      matches: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 }
    }
  },
  
  // ========== TEAMS & TOURNAMENTS ==========
  teams: [{
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    teamName: String,
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  tournaments: [{
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament'
    },
    tournamentName: String,
    participatedAt: Date
  }],
  
  // ========== MATCH HISTORY ==========
  matchHistory: [{
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match'
    },
    date: Date,
    performance: {
      runs: Number,
      wickets: Number,
      catches: Number
    }
  }],
  
  // ========== SOCIAL FEATURES (Feature #10: Community) ==========
  social: {
    followers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    following: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    
    // Posts & Activity
    posts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    }],
    
    // Likes & Comments
    likedMatches: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match'
    }],
    
    // Friends/Connections
    friends: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  
  // ========== MEDIA & ASSETS ==========
  media: {
    profilePicture: {
      type: String,
      default: 'https://via.placeholder.com/150'
    },
    coverPhoto: String,
    actionPhotos: [String],
    videos: [String]
  },
  
  // ========== ACHIEVEMENTS & BADGES ==========
  achievements: [{
    title: String,
    description: String,
    icon: String,
    earnedAt: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['milestone', 'tournament', 'performance', 'special']
    }
  }],
  
  // ========== RANKINGS & RATINGS ==========
  rankings: {
    overall: {
      type: Number,
      default: 0
    },
    batting: {
      type: Number,
      default: 0
    },
    bowling: {
      type: Number,
      default: 0
    },
    allRounder: {
      type: Number,
      default: 0
    }
  },
  
  rating: {
    overall: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    reviews: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      rating: Number,
      comment: String,
      date: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // ========== NOTIFICATIONS & PREFERENCES ==========
  notifications: {
    matchInvites: {
      type: Boolean,
      default: true
    },
    tournamentUpdates: {
      type: Boolean,
      default: true
    },
    scoreUpdates: {
      type: Boolean,
      default: true
    },
    socialActivity: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    }
  },
  
  // ========== ACCOUNT STATUS ==========
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  // ========== DEVICE & SESSION INFO ==========
  devices: [{
    deviceId: String,
    deviceType: String,
    lastUsed: Date,
    fcmToken: String // For push notifications
  }],
  
  // ========== PREMIUM FEATURES ==========
  premium: {
    isPremium: {
      type: Boolean,
      default: false
    },
    expiresAt: Date,
    features: [String]
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ========== INDEXES FOR PERFORMANCE ==========
// Note: email and phone already have indexes from unique: true
userSchema.index({ 'profile.location.city': 1 });
userSchema.index({ 'profile.availability': 1 });
userSchema.index({ 'stats.batting.runs': -1 });
userSchema.index({ 'stats.bowling.wickets': -1 });

// ========== VIRTUAL FIELDS ==========

// Batting Average
userSchema.virtual('stats.batting.calculatedAverage').get(function() {
  const innings = this.stats?.batting?.innings || 0;
  const notOuts = this.stats?.batting?.notOuts || 0;
  const runs = this.stats?.batting?.runs || 0;
  
  if (innings - notOuts === 0) return 0;
  return (runs / (innings - notOuts)).toFixed(2);
});

// Bowling Average
userSchema.virtual('stats.bowling.calculatedAverage').get(function() {
  const wickets = this.stats?.bowling?.wickets || 0;
  const runs = this.stats?.bowling?.runs || 0;
  
  if (wickets === 0) return 0;
  return (runs / wickets).toFixed(2);
});

// Total Followers - FIXED
userSchema.virtual('followerCount').get(function() {
  return this.social?.followers?.length || 0;
});

// Total Following - FIXED
userSchema.virtual('followingCount').get(function() {
  return this.social?.following?.length || 0;
});

// Win Percentage
userSchema.virtual('winPercentage').get(function() {
  const matchesPlayed = this.stats?.matchesPlayed || 0;
  const wins = this.stats?.wins || 0;
  
  if (matchesPlayed === 0) return 0;
  return ((wins / matchesPlayed) * 100).toFixed(2);
});

// ========== MIDDLEWARE ==========

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Update lastActive on login
userSchema.pre("save", function(next) {
  if (this.isModified()) {
    this.lastActive = new Date();
  }
  next();
});

// ========== METHODS ==========

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Update batting stats
userSchema.methods.updateBattingStats = function(runs, ballsFaced, isOut, isCentury, isHalfCentury) {
  this.stats.batting.innings++;
  this.stats.batting.runs += runs;
  this.stats.batting.ballsFaced += ballsFaced;
  
  if (runs > this.stats.batting.highestScore) {
    this.stats.batting.highestScore = runs;
  }
  
  if (!isOut) {
    this.stats.batting.notOuts++;
  }
  
  if (runs === 0 && isOut) {
    this.stats.batting.ducks++;
  }
  
  if (isCentury) {
    this.stats.batting.centuries++;
  } else if (isHalfCentury) {
    this.stats.batting.halfCenturies++;
  }
  
  // Recalculate average and strike rate
  const innings = this.stats.batting.innings;
  const notOuts = this.stats.batting.notOuts;
  this.stats.batting.average = innings - notOuts > 0 
    ? (this.stats.batting.runs / (innings - notOuts)).toFixed(2)
    : 0;
  
  this.stats.batting.strikeRate = this.stats.batting.ballsFaced > 0
    ? ((this.stats.batting.runs / this.stats.batting.ballsFaced) * 100).toFixed(2)
    : 0;
};

// Update bowling stats
userSchema.methods.updateBowlingStats = function(overs, runs, wickets, maidens) {
  this.stats.bowling.innings++;
  this.stats.bowling.overs += overs;
  this.stats.bowling.runs += runs;
  this.stats.bowling.wickets += wickets;
  this.stats.bowling.maidens += maidens;
  
  // Check for best figures
  if (wickets > this.stats.bowling.bestFigures.wickets) {
    this.stats.bowling.bestFigures.wickets = wickets;
    this.stats.bowling.bestFigures.runs = runs;
  }
  
  if (wickets >= 5) {
    this.stats.bowling.fiveWickets++;
  }
  
  if (wickets >= 10) {
    this.stats.bowling.tenWickets++;
  }
  
  // Recalculate economy and average
  this.stats.bowling.economy = this.stats.bowling.overs > 0
    ? (this.stats.bowling.runs / this.stats.bowling.overs).toFixed(2)
    : 0;
  
  this.stats.bowling.average = this.stats.bowling.wickets > 0
    ? (this.stats.bowling.runs / this.stats.bowling.wickets).toFixed(2)
    : 0;
  
  this.stats.bowling.strikeRate = this.stats.bowling.wickets > 0
    ? ((this.stats.bowling.balls / this.stats.bowling.wickets)).toFixed(2)
    : 0;
};

// Update fielding stats
userSchema.methods.updateFieldingStats = function(catches, runOuts, stumpings) {
  this.stats.fielding.catches += catches || 0;
  this.stats.fielding.runOuts += runOuts || 0;
  this.stats.fielding.stumpings += stumpings || 0;
};

// Follow another user
userSchema.methods.followUser = async function(userId) {
  if (!this.social.following.includes(userId)) {
    this.social.following.push(userId);
  }
};

// Unfollow a user
userSchema.methods.unfollowUser = async function(userId) {
  this.social.following = this.social.following.filter(
    id => id.toString() !== userId.toString()
  );
};

// ========== STATIC METHODS ==========

// Get top batsmen (leaderboard)
userSchema.statics.getTopBatsmen = function(limit = 10) {
  return this.find()
    .sort({ 'stats.batting.runs': -1 })
    .limit(limit)
    .select('name profile.displayName stats.batting media.profilePicture');
};

// Get top bowlers (leaderboard)
userSchema.statics.getTopBowlers = function(limit = 10) {
  return this.find()
    .sort({ 'stats.bowling.wickets': -1 })
    .limit(limit)
    .select('name profile.displayName stats.bowling media.profilePicture');
};

// Find players by location (nearby players)
userSchema.statics.findPlayersByLocation = function(city, availability) {
  const query = {};
  if (city) query['profile.location.city'] = new RegExp(city, 'i');
  if (availability) query['profile.availability'] = availability;
  
  return this.find(query)
    .select('name profile stats media.profilePicture')
    .limit(50);
};

// Search players by criteria
userSchema.statics.searchPlayers = function(filters) {
  const query = {};
  
  if (filters.playerType) query['profile.playerType'] = filters.playerType;
  if (filters.battingStyle) query['profile.battingStyle'] = filters.battingStyle;
  if (filters.bowlingStyle) query['profile.bowlingStyle'] = filters.bowlingStyle;
  if (filters.availability) query['profile.availability'] = filters.availability;
  if (filters.location) query['profile.location.city'] = new RegExp(filters.location, 'i');
  if (filters.experienceLevel) query['profile.experienceLevel'] = filters.experienceLevel;
  
  return this.find(query)
    .select('name profile stats media.profilePicture')
    .limit(20);
};

module.exports = mongoose.model("User", userSchema);