// backend/models/Post.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament'
  },
  
  // Post content
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // Media attachments
  media: {
    images: [String],
    videos: [String]
  },
  
  // Post type
  type: {
    type: String,
    enum: ['text', 'match_update', 'achievement', 'photo', 'video'],
    default: 'text'
  },
  
  // Social interactions
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  shares: {
    type: Number,
    default: 0
  },
  
  // Visibility
  visibility: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
  
}, {
  timestamps: true
});

// Index for performance
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ matchId: 1 });

module.exports = mongoose.model('Post', postSchema);
