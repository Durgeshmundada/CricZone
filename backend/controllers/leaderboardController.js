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
<<<<<<< HEAD
    const allRounders = (await User.find()
      .select('name profile.displayName profile.playerType stats media.profilePicture')
      .lean())
      .filter((user) => {
        const profileType = String(user?.profile?.playerType || '').toLowerCase();
        const hasBatting = Number(user?.stats?.batting?.runs || 0) > 0;
        const hasBowling = Number(user?.stats?.bowling?.wickets || 0) > 0;
        return profileType === 'all-rounder' || (hasBatting && hasBowling);
      })
      .map((user) => ({
        ...user,
        allRounderScore:
          Number(user?.stats?.batting?.runs || 0) +
          (Number(user?.stats?.bowling?.wickets || 0) * 25) +
          (Number(user?.stats?.wins || 0) * 10)
      }))
      .sort((left, right) => right.allRounderScore - left.allRounderScore)
      .slice(0, limit);
=======
    const allRounders = await User.find({
      'profile.playerType': 'All-rounder'
    })
      .sort({ 'rankings.allRounder': -1 })
      .limit(limit)
      .select('name profile.displayName stats media.profilePicture');
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878

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
