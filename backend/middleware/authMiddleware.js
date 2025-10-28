const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ✅ Protect routes (only logged-in users can access)
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "defaultSecretKey"
    );

    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    next();
  } catch (error) {
    console.error("❌ JWT Middleware Error:", error.message);
    res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

// ✅ Admin-only access
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied — Admins only 🚫" });
  }
};

module.exports = { protect, admin };
