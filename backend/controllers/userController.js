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
};

exports.register = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const phone = String(req.body.phone || "").trim();

  if (!name || !email || !password) {
    throw createError(400, "Name, email, and password are required");
  }

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
