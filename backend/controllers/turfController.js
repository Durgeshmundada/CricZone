const Turf = require('../models/Turf');
const isProduction = process.env.NODE_ENV === 'production';

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

exports.addTurf = async (req, res) => {
  try {
    const {
      turfName,
      location,
      sportTypes,
      turfSize,
      surfaceType,
      images,
      amenities,
      basePricingPerSlot
    } = req.body;

    if (!turfName || !location || !sportTypes || !turfSize || !surfaceType || basePricingPerSlot === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required turf fields'
      });
    }

    const turf = await Turf.create({
      turfName,
      ownerId: req.user._id,
      location,
      sportTypes,
      turfSize,
      surfaceType,
      images: Array.isArray(images) ? images : [],
      amenities: amenities || {},
      basePricingPerSlot
    });

    return res.status(201).json({
      success: true,
      message: 'Turf added successfully',
      turf
    });
  } catch (error) {
    return sendServerError(res, 'Failed to add turf', error);
  }
};

exports.getAllTurfs = async (_req, res) => {
  try {
    const turfs = await Turf.find({ isActive: true })
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: turfs.length,
      data: turfs
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch turfs', error);
  }
};

exports.getTurfById = async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id)
      .populate('ownerId', 'name email phone');

    if (!turf) {
      return res.status(404).json({
        success: false,
        message: 'Turf not found'
      });
    }

    return res.json({
      success: true,
      turf
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch turf', error);
  }
};

module.exports = exports;
