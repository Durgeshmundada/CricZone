const express = require("express");
const { addTurf, getAllTurfs } = require("../controllers/turfController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Only admin can add turfs
router.post("/", protect, addTurf);

// Anyone can view turfs
router.get("/", getAllTurfs);

module.exports = router;
