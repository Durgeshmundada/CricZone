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
