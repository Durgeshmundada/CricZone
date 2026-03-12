const express = require('express');
const {
  getTopBatsmen,
  getTopBowlers,
  getTopAllRounders
} = require('../controllers/leaderboardController');

const router = express.Router();

router.get('/batsmen', getTopBatsmen);
router.get('/bowlers', getTopBowlers);
router.get('/all-rounders', getTopAllRounders);

module.exports = router;
