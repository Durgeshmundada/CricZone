const express = require("express");
const { addTurf, getAllTurfs } = require("../controllers/turfController");
const { protect, adminOrTurfOwner } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, adminOrTurfOwner, addTurf);
router.get("/", getAllTurfs);
router.get("/all", getAllTurfs);

module.exports = router;
