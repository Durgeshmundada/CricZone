<<<<<<< HEAD
const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    inviteStatus: {
      type: String,
      enum: ["accepted", "pending", "rejected"],
      default: "accepted"
    },
    invitedAt: {
      type: Date,
=======
// backend/models/Team.js
const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true
  },
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      default: null
    },
    isRegistered: {
      type: Boolean,
      default: false
    },
    inviteStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'accepted'
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
      default: null
    },
    respondedAt: {
      type: Date,
      default: null
<<<<<<< HEAD
    }
  },
  { _id: true }
);

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    members: {
      type: [memberSchema],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

teamSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Team", teamSchema);
=======
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  stats: {
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
    draws: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Team', teamSchema);
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
