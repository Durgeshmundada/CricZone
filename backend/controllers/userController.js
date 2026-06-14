// backend/controllers/userController.js
const User = require("../models/User");
const escapeRegex = require("../utils/escapeRegex");
const {
  clearRefreshCookie,
  getRefreshTokenFromRequest,
  hashRefreshToken,
  issueSession
} = require("../services/authTokenService");
const { getRequestLogger } = require("../utils/logger");
const isProduction = process.env.NODE_ENV === "production";
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const sendServerError = (res, message, error) => {
  getRequestLogger(res).error({ err: error }, message);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

const toPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role
});

const sendAuthResponse = (res, status, user, session) => {
  const publicUser = toPublicUser(user);
  return res.status(status).json({
    success: true,
    ...publicUser,
    token: session.token,
    expiresIn: session.expiresIn,
    user: publicUser
  });
};

// Register User
const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (role && role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Role assignment is not allowed during self-registration"
      });
    }

    // Normalize email to lowercase to match schema
    const normalizedEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      phone,
      password,
      role: "user"
    });

    const session = await issueSession(user, req, res);
    return sendAuthResponse(res, 201, user, session);
  } catch (error) {
    return sendServerError(res, "Error registering user", error);
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    // Normalize email to lowercase to match schema
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail })
      .select("+password +failedLoginAttempts +lockUntil +refreshTokens");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const now = Date.now();
    if (user.lockUntil && user.lockUntil.getTime() > now) {
      return res.status(423).json({
        success: false,
        message: "Account temporarily locked after repeated failed login attempts",
        retryAfterSeconds: Math.ceil((user.lockUntil.getTime() - now) / 1000)
      });
    }

    if (user.lockUntil) {
      user.lockUntil = null;
      user.failedLoginAttempts = 0;
    }

    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      const isNowLocked = user.failedLoginAttempts >= MAX_FAILED_LOGINS;
      if (isNowLocked) {
        user.lockUntil = new Date(now + LOCK_DURATION_MS);
      }
      await user.save({ validateBeforeSave: false });

      return res.status(isNowLocked ? 423 : 401).json({
        success: false,
        message: isNowLocked
          ? "Account temporarily locked after repeated failed login attempts"
          : "Invalid credentials",
        ...(isNowLocked ? { retryAfterSeconds: Math.ceil(LOCK_DURATION_MS / 1000) } : {})
      });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    const session = await issueSession(user, req, res);
    return sendAuthResponse(res, 200, user, session);
  } catch (error) {
    return sendServerError(res, "Error logging in", error);
  }
};

const refreshSession = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh token is required" });
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const user = await User.findOne({ "refreshTokens.tokenHash": tokenHash }).select("+refreshTokens");
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }

    const storedToken = user.refreshTokens.find((entry) => entry.tokenHash === tokenHash);
    user.refreshTokens = user.refreshTokens.filter((entry) => entry.tokenHash !== tokenHash);

    if (!storedToken || new Date(storedToken.expiresAt).getTime() <= Date.now()) {
      await user.save({ validateBeforeSave: false });
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: "Refresh token expired" });
    }

    const session = await issueSession(user, req, res);
    return res.json({ success: true, token: session.token, expiresIn: session.expiresIn });
  } catch (error) {
    return sendServerError(res, "Error refreshing session", error);
  }
};

const logoutUser = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const user = await User.findOne({ "refreshTokens.tokenHash": tokenHash }).select("+refreshTokens");
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((entry) => entry.tokenHash !== tokenHash);
        await user.save({ validateBeforeSave: false });
      }
    }

    clearRefreshCookie(res);
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return sendServerError(res, "Error logging out", error);
  }
};

// ========== PLAYER DISCOVERY & SEARCH (Feature #9) ==========

// Search for players with filters
const searchPlayers = async (req, res) => {
  try {
    const {
      playerType,
      location,
      bowlingStyle,
      battingStyle,
      availability,
      experienceLevel,
      search
    } = req.query;

    const filters = {};

    if (playerType) {
      filters["profile.playerType"] = playerType;
    }

    if (location) {
      filters["profile.location.city"] = new RegExp(escapeRegex(location), "i");
    }

    if (bowlingStyle) {
      filters["profile.bowlingStyle"] = bowlingStyle;
    }

    if (battingStyle) {
      filters["profile.battingStyle"] = battingStyle;
    }

    if (availability) {
      filters["profile.availability"] = availability;
    }

    if (experienceLevel) {
      filters["profile.experienceLevel"] = experienceLevel;
    }

    if (search) {
      filters.$or = [
        { name: new RegExp(escapeRegex(search), "i") },
        { "profile.displayName": new RegExp(escapeRegex(search), "i") }
      ];
    }

    const players = await User.find(filters)
      .select("name email profile stats media.profilePicture rankings")
      .limit(50)
      .sort({ "rankings.overall": -1 });

    res.json({
      success: true,
      count: players.length,
      data: players
    });
  } catch (error) {
    return sendServerError(res, "Error searching players", error);
  }
};

// Get nearby players based on location
const getNearbyPlayers = async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required"
      });
    }

    const players = await User.find({
      "profile.location.city": new RegExp(escapeRegex(city), "i"),
      "profile.availability": { $in: ["Available", "Looking for team"] }
    })
      .select("name profile stats media.profilePicture")
      .limit(30);

    res.json({
      success: true,
      count: players.length,
      data: players
    });
  } catch (error) {
    return sendServerError(res, "Error finding nearby players", error);
  }
};

// ========== LEADERBOARDS (Feature #6) ==========

// Get top batsmen leaderboard
const getTopBatsmen = async (req, res) => {
  try {
    const { limit = 10, format } = req.query;

    let sortField = "stats.batting.runs";

    if (format === "T20") {
      sortField = "formatStats.T20.runs";
    } else if (format === "ODI") {
      sortField = "formatStats.ODI.runs";
    }

    const batsmen = await User.find()
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit))
      .select("name profile.displayName stats.batting formatStats media.profilePicture");

    res.json({
      success: true,
      count: batsmen.length,
      leaderboard: batsmen
    });
  } catch (error) {
    return sendServerError(res, "Error fetching top batsmen", error);
  }
};

// Get top bowlers leaderboard
const getTopBowlers = async (req, res) => {
  try {
    const { limit = 10, format } = req.query;

    let sortField = "stats.bowling.wickets";

    if (format === "T20") {
      sortField = "formatStats.T20.wickets";
    } else if (format === "ODI") {
      sortField = "formatStats.ODI.wickets";
    }

    const bowlers = await User.find()
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit))
      .select("name profile.displayName stats.bowling formatStats media.profilePicture");

    res.json({
      success: true,
      count: bowlers.length,
      leaderboard: bowlers
    });
  } catch (error) {
    return sendServerError(res, "Error fetching top bowlers", error);
  }
};

// Get all-rounders leaderboard
const getTopAllRounders = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const allRounders = await User.find({
      "profile.playerType": "All-rounder"
    })
      .sort({ "rankings.allRounder": -1 })
      .limit(parseInt(limit))
      .select("name profile stats media.profilePicture rankings");

    res.json({
      success: true,
      count: allRounders.length,
      leaderboard: allRounders
    });
  } catch (error) {
    return sendServerError(res, "Error fetching all-rounders", error);
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const allowedRoles = ["admin", "user", "scorer", "organizer", "turf_owner"];

    if (!userId || !role) {
      return res.status(400).json({
        success: false,
        message: "userId and role are required"
      });
    }

    if (!allowedRoles.includes(String(role))) {
      return res.status(400).json({
        success: false,
        message: `role must be one of: ${allowedRoles.join(", ")}`
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { role: String(role) } },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.json({
      success: true,
      message: "User role updated successfully",
      user
    });
  } catch (error) {
    return sendServerError(res, "Error updating user role", error);
  }
};

// ========== USER PROFILE MANAGEMENT ==========

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("teams.teamId", "name")
      .populate("tournaments.tournamentId", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    return sendServerError(res, "Error fetching profile", error);
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const updates = req.body;
    const allowedFields = ["name", "phone", "profile", "media", "notifications"];
    const safeUpdates = {};

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    });

    if (Object.keys(safeUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid profile fields provided for update"
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: safeUpdates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user
    });
  } catch (error) {
    return sendServerError(res, "Error updating profile", error);
  }
};

// Get player by ID (public)
const getPlayerById = async (req, res) => {
  try {
    const player = await User.findById(req.params.id)
      .select("-password")
      .populate("teams.teamId", "name")
      .populate("matchHistory.matchId", "matchName matchDate");

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found"
      });
    }

    res.json({
      success: true,
      player
    });
  } catch (error) {
    return sendServerError(res, "Error fetching player", error);
  }
};

// ========== SOCIAL FEATURES (Feature #10: Community) ==========

// Follow a user
const followUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself"
      });
    }

    const user = await User.findById(req.user._id);
    const targetUser = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Current user not found"
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!user.social.following.includes(userId)) {
      user.social.following.push(userId);
      await user.save();
    }

    if (!targetUser.social.followers.includes(req.user._id)) {
      targetUser.social.followers.push(req.user._id);
      await targetUser.save();
    }

    res.json({
      success: true,
      message: "User followed successfully"
    });
  } catch (error) {
    return sendServerError(res, "Error following user", error);
  }
};

// Unfollow a user
const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(req.user._id);
    const targetUser = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Current user not found"
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.social.following = user.social.following.filter(
      (id) => id.toString() !== userId
    );
    await user.save();

    targetUser.social.followers = targetUser.social.followers.filter(
      (id) => id.toString() !== req.user._id.toString()
    );
    await targetUser.save();

    res.json({
      success: true,
      message: "User unfollowed successfully"
    });
  } catch (error) {
    return sendServerError(res, "Error unfollowing user", error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  getPlayerById,
  searchPlayers,
  getNearbyPlayers,
  getTopBatsmen,
  getTopBowlers,
  getTopAllRounders,
  updateUserRole,
  followUser,
  unfollowUser,
  // Aliases for backward compatibility with routes that use different names
  register: registerUser,
  login: loginUser,
  getProfile: getUserProfile,
  updateProfile: updateUserProfile,
  getAllUsers: async (_req, res) => {
    try {
      const users = await User.find().select("-password").sort({ createdAt: -1 }).limit(200);
      res.json({ success: true, data: users });
    } catch (error) {
      return sendServerError(res, "Error fetching users", error);
    }
  }
};
