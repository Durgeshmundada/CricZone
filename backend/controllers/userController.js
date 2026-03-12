<<<<<<< HEAD
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { asyncHandler, createError, sendSuccess } = require("../utils/http");
const { safeUser } = require("../utils/presenters");

const validateEmail = (email) => /\S+@\S+\.\S+/.test(String(email || "").trim());

const buildToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw createError(500, "JWT_SECRET is not configured");
  }

  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d"
  });
};

const sendAuthPayload = (res, user, status, message) => {
  const safe = safeUser(user);
  return sendSuccess(
    res,
    {
      message,
      token: buildToken(user),
      user: safe,
      data: safe
    },
    status
  );
=======
// backend/controllers/userController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const isProduction = process.env.NODE_ENV === "production";

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

// Generate JWT Token
const generateToken = (id) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ id }, jwtSecret, {
    expiresIn: "7d",
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

    const token = generateToken(user._id);
    
    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    return sendServerError(res, "Error registering user", error);
  }
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
};

exports.register = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const phone = String(req.body.phone || "").trim();

<<<<<<< HEAD
  if (!name || !email || !password) {
    throw createError(400, "Name, email, and password are required");
=======
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide email and password" 
      });
    }

    // Normalize email to lowercase to match schema
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }
    

    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    const token = generateToken(user._id);
    
    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    return sendServerError(res, "Error logging in", error);
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
  }

<<<<<<< HEAD
  if (!validateEmail(email)) {
    throw createError(400, "Please provide a valid email address");
  }

  if (password.length < 8) {
    throw createError(400, "Password must be at least 8 characters long");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createError(409, "Email already registered");
  }

  const user = await User.create({
    name,
    email,
    phone,
    password: await bcrypt.hash(password, 12),
    profile: {
      displayName: name
    }
  });

  return sendAuthPayload(res, user, 201, "User registered successfully");
});

exports.login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    throw createError(400, "Email and password are required");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw createError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw createError(401, "Invalid email or password");
  }

  user.password = undefined;
  return sendAuthPayload(res, user, 200, "Login successful");
});

exports.getProfile = asyncHandler(async (req, res) => {
  const safe = safeUser(req.user);
  return sendSuccess(res, {
    user: safe,
    data: safe
  });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const updates = {};
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const displayName = String(req.body.displayName || "").trim();
  const playerType = String(req.body.playerType || "").trim();
  const availabilityStatus = String(req.body.availabilityStatus || "").trim();

  if (name) updates.name = name;
  if (phone) updates.phone = phone;
  if (displayName) updates["profile.displayName"] = displayName;
  if (playerType) updates["profile.playerType"] = playerType;
  if (availabilityStatus) updates["profile.availabilityStatus"] = availabilityStatus;

  if (Object.keys(updates).length === 0) {
    throw createError(400, "No profile fields provided");
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true
  });

  const safe = safeUser(user);
  return sendSuccess(res, {
    message: "Profile updated",
    user: safe,
    data: safe
  });
});

exports.getAllUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(200);
  return sendSuccess(res, {
    data: users.map(safeUser)
  });
});

exports.searchPlayers = asyncHandler(async (req, res) => {
  const search = String(req.query.search || "").trim();
  const query = search
    ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { "profile.displayName": { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      }
    : {};

  const users = await User.find(query)
    .sort({ "stats.matchesPlayed": -1, name: 1 })
    .limit(100);

  return sendSuccess(res, {
    data: users.map((user) => {
      const safe = safeUser(user);
      return {
        _id: safe._id,
        name: safe.name,
        email: safe.email,
        role: safe.role,
        profile: safe.profile,
        media: safe.media,
        stats: safe.stats
      };
    })
  });
});
=======
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
      filters['profile.playerType'] = playerType;
    }
    
    if (location) {
      filters['profile.location.city'] = new RegExp(location, 'i');
    }
    
    if (bowlingStyle) {
      filters['profile.bowlingStyle'] = bowlingStyle;
    }
    
    if (battingStyle) {
      filters['profile.battingStyle'] = battingStyle;
    }
    
    if (availability) {
      filters['profile.availability'] = availability;
    }
    
    if (experienceLevel) {
      filters['profile.experienceLevel'] = experienceLevel;
    }
    
    if (search) {
      filters.$or = [
        { name: new RegExp(search, 'i') },
        { 'profile.displayName': new RegExp(search, 'i') }
      ];
    }

    const players = await User.find(filters)
      .select('name email profile stats media.profilePicture rankings')
      .limit(50)
      .sort({ 'rankings.overall': -1 });

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
    const { city, radius } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required"
      });
    }

    const players = await User.find({
      'profile.location.city': new RegExp(city, 'i'),
      'profile.availability': { $in: ['Available', 'Looking for team'] }
    })
      .select('name profile stats media.profilePicture')
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

    let sortField = 'stats.batting.runs';
    
    if (format === 'T20') {
      sortField = 'formatStats.T20.runs';
    } else if (format === 'ODI') {
      sortField = 'formatStats.ODI.runs';
    }

    const batsmen = await User.find()
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit))
      .select('name profile.displayName stats.batting formatStats media.profilePicture');

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

    let sortField = 'stats.bowling.wickets';
    
    if (format === 'T20') {
      sortField = 'formatStats.T20.wickets';
    } else if (format === 'ODI') {
      sortField = 'formatStats.ODI.wickets';
    }

    const bowlers = await User.find()
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit))
      .select('name profile.displayName stats.bowling formatStats media.profilePicture');

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
      'profile.playerType': 'All-rounder'
    })
      .sort({ 'rankings.allRounder': -1 })
      .limit(parseInt(limit))
      .select('name profile stats media.profilePicture rankings');

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
    const allowedRoles = ['admin', 'user', 'scorer', 'organizer', 'turf_owner'];

    if (!userId || !role) {
      return res.status(400).json({
        success: false,
        message: 'userId and role are required'
      });
    }

    if (!allowedRoles.includes(String(role))) {
      return res.status(400).json({
        success: false,
        message: `role must be one of: ${allowedRoles.join(', ')}`
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { role: String(role) } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    return sendServerError(res, 'Error updating user role', error);
  }
};

// ========== USER PROFILE MANAGEMENT ==========

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('teams.teamId', 'name')
      .populate('tournaments.tournamentId', 'name');

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
    ).select('-password');

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
      .select('-password')
      .populate('teams.teamId', 'name')
      .populate('matchHistory.matchId', 'matchName matchDate');

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
      id => id.toString() !== userId
    );
    await user.save();

    targetUser.social.followers = targetUser.social.followers.filter(
      id => id.toString() !== req.user._id.toString()
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
  unfollowUser
};
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
