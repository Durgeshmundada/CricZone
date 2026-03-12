<<<<<<< HEAD
const Turf = require("../models/Turf");
const { asyncHandler, createError, sendSuccess } = require("../utils/http");
const { presentTurf } = require("../utils/presenters");

exports.addTurf = asyncHandler(async (req, res) => {
  const turfName = String(req.body.turfName || req.body.name || "").trim();
  const address = typeof req.body.location === "object"
    ? String(req.body.location.address || req.body.location.city || "").trim()
    : String(req.body.location || "").trim();
  const city = typeof req.body.location === "object"
    ? String(req.body.location.city || "").trim()
    : address;
  const state = typeof req.body.location === "object"
    ? String(req.body.location.state || "").trim()
    : "";
  const pricePerHour = Number(req.body.pricePerHour ?? req.body.basePricingPerSlot);

  if (!turfName || !address || !Number.isFinite(pricePerHour) || pricePerHour < 0) {
    throw createError(400, "Turf name, location, and price are required");
=======
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
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
  }

<<<<<<< HEAD
  const turf = await Turf.create({
    turfName,
    name: turfName,
    location: {
      address,
      city,
      state
    },
    pricePerHour,
    basePricingPerSlot: Number(req.body.basePricingPerSlot ?? pricePerHour),
    sportTypes: Array.isArray(req.body.sportTypes) && req.body.sportTypes.length > 0
      ? req.body.sportTypes
      : [String(req.body.type || "cricket")],
    surfaceType: String(req.body.surfaceType || "Standard").trim(),
    type: String(req.body.type || "cricket").trim(),
    images: Array.isArray(req.body.images) ? req.body.images : [],
    ownerId: req.user?._id || null
  });

  return sendSuccess(res, {
    message: "Turf added successfully",
    turf: presentTurf(turf),
    data: presentTurf(turf)
  }, 201);
});

exports.getAllTurfs = asyncHandler(async (_req, res) => {
  const turfs = await Turf.find({ isActive: true }).sort({ createdAt: -1 });
  return sendSuccess(res, {
    data: turfs.map(presentTurf)
  });
});
=======
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
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878
