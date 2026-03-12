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
      default: null
    },
    respondedAt: {
      type: Date,
      default: null
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
