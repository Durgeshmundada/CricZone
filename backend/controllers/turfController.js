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
  }

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
