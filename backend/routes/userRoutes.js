const express = require("express");
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  getUserProfile 
} = require("../controllers/userController");
const { protect } = require('../middleware/authMiddleware');

// ✅ POST /api/users/register
router.post("/register", registerUser);

// ✅ POST /api/users/login
router.post("/login", loginUser);

// ✅ GET /api/users/profile
// This is the missing route. We add 'protect' middleware 
// to ensure the user is logged in.
router.get("/profile", protect, getUserProfile);

module.exports = router;
