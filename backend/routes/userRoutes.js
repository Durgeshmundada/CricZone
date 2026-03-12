const express = require("express");
const userController = require("../controllers/userController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", userController.register);
router.post("/register", userController.register);
router.post("/login", userController.login);
router.get("/search-players", userController.searchPlayers);
router.get("/profile", protect, userController.getProfile);
router.put("/profile", protect, userController.updateProfile);
router.get("/", protect, admin, userController.getAllUsers);

module.exports = router;
