const User = require('../models/User');
const isProduction = process.env.NODE_ENV === 'production';

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

exports.getTopBatsmen = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const batsmen = await User.find()
      .sort({ 'stats.batting.runs': -1 })
      .limit(limit)
      .select('name profile.displayName stats.batting media.profilePicture');

    return res.json({
      success: true,
      count: batsmen.length,
      batsmen
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch top batsmen', error);
  }
};

exports.getTopBowlers = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const bowlers = await User.find()
      .sort({ 'stats.bowling.wickets': -1 })
      .limit(limit)
      .select('name profile.displayName stats.bowling media.profilePicture');

    return res.json({
      success: true,
      count: bowlers.length,
      bowlers
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch top bowlers', error);
  }
};

exports.getTopAllRounders = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const allRounders = await User.find({
      'profile.playerType': 'All-rounder'
    })
      .sort({ 'rankings.allRounder': -1 })
      .limit(limit)
      .select('name profile.displayName stats media.profilePicture');

    return res.json({
      success: true,
      count: allRounders.length,
      allRounders
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch top all-rounders', error);
  }
};

module.exports = exports;
