const express = require("express");
const matchController = require("../controllers/matchController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", matchController.getAllMatches);
router.post("/", protect, matchController.createMatch);
router.get("/user/my-matches", protect, matchController.getMyMatches);
router.get("/:matchId/report", matchController.getMatchReport);
router.get("/:matchId", matchController.getMatch);
router.put("/:matchId/toss", protect, matchController.setToss);
router.put("/:matchId/score", protect, matchController.saveScore);

module.exports = router;
