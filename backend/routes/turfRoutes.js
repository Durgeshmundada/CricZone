const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const Turf = require('../models/Turf');

const isProduction = process.env.NODE_ENV === 'production';
const allowedSurfaceTypes = ['artificial grass', 'natural grass', 'synthetic'];
const allowedSports = ['cricket', 'football', 'badminton', 'tennis', 'volleyball'];

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeSportTypes = (sportTypes) => {
  if (!Array.isArray(sportTypes) || sportTypes.length === 0) {
    return null;
  }

  const normalized = sportTypes
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);

  if (normalized.length === 0) return null;
  const invalidSport = normalized.find((sport) => !allowedSports.includes(sport));
  if (invalidSport) {
    throw new Error(`sportTypes contains unsupported sport: ${invalidSport}`);
  }

  return [...new Set(normalized)];
};

const normalizeTurfSize = (turfSize) => {
  if (!turfSize || typeof turfSize !== 'object') return null;

  const length = toFiniteNumber(turfSize.length);
  const width = toFiniteNumber(turfSize.width);
  if (length === null || width === null || length <= 0 || width <= 0) {
    return null;
  }

  return {
    length,
    width,
    unit: turfSize.unit ? String(turfSize.unit).trim() : 'meters'
  };
};

const normalizeLocation = (location) => {
  if (!location || typeof location !== 'object') return null;

  const latitude = toFiniteNumber(location.latitude);
  const longitude = toFiniteNumber(location.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const address = String(location.address || '').trim();
  const city = String(location.city || '').trim();
  const state = String(location.state || '').trim();
  const pincode = String(location.pincode || '').trim();

  if (!address || !city || !state || !pincode) return null;

  return {
    address,
    city,
    state,
    pincode,
    coordinates: {
      type: 'Point',
      coordinates: [longitude, latitude]
    }
  };
};

router.post('/add', protect, authorizeRoles('admin', 'turf_owner'), async (req, res) => {
  try {
    const {
      turfName,
      location,
      sportTypes,
      turfSize,
      surfaceType,
      amenities,
      images,
      basePricingPerSlot
    } = req.body;

    if (!turfName || !String(turfName).trim()) {
      return res.status(400).json({
        success: false,
        message: 'turfName is required'
      });
    }

    const normalizedLocation = normalizeLocation(location);
    if (!normalizedLocation) {
      return res.status(400).json({
        success: false,
        message: 'location must include valid address, city, state, pincode, latitude and longitude'
      });
    }

    let normalizedSportTypes;
    try {
      normalizedSportTypes = normalizeSportTypes(sportTypes);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message
      });
    }

    if (!normalizedSportTypes) {
      return res.status(400).json({
        success: false,
        message: 'sportTypes is required and must be a non-empty array'
      });
    }

    const normalizedTurfSize = normalizeTurfSize(turfSize);
    if (!normalizedTurfSize) {
      return res.status(400).json({
        success: false,
        message: 'turfSize must include valid numeric length and width'
      });
    }

    const normalizedSurfaceType = String(surfaceType || '').trim().toLowerCase();
    if (!allowedSurfaceTypes.includes(normalizedSurfaceType)) {
      return res.status(400).json({
        success: false,
        message: `surfaceType must be one of: ${allowedSurfaceTypes.join(', ')}`
      });
    }

    const normalizedBasePrice = toFiniteNumber(basePricingPerSlot);
    if (normalizedBasePrice === null || normalizedBasePrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'basePricingPerSlot must be a valid non-negative number'
      });
    }

    const newTurf = new Turf({
      turfName: String(turfName).trim(),
      ownerId: req.user._id,
      location: normalizedLocation,
      sportTypes: normalizedSportTypes,
      turfSize: normalizedTurfSize,
      surfaceType: normalizedSurfaceType,
      amenities: amenities && typeof amenities === 'object' ? amenities : {},
      images: Array.isArray(images) ? images : [],
      basePricingPerSlot: normalizedBasePrice
    });

    await newTurf.save();

    return res.status(201).json({
      success: true,
      message: 'Turf added successfully',
      data: newTurf
    });
  } catch (error) {
    return sendServerError(res, 'Error adding turf', error);
  }
});

router.get('/all', async (_req, res) => {
  try {
    const turfs = await Turf.find({ isActive: true })
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: turfs.length,
      data: turfs
    });
  } catch (error) {
    return sendServerError(res, 'Error fetching turfs', error);
  }
});

router.get('/owned', protect, authorizeRoles('admin', 'turf_owner'), async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { ownerId: req.user._id };
    const turfs = await Turf.find(query)
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: turfs.length,
      data: turfs
    });
  } catch (error) {
    return sendServerError(res, 'Error fetching owned turfs', error);
  }
});

router.post('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 5000 } = req.body;

    const normalizedLatitude = toFiniteNumber(latitude);
    const normalizedLongitude = toFiniteNumber(longitude);
    const normalizedMaxDistance = toFiniteNumber(maxDistance);

    if (normalizedLatitude === null || normalizedLongitude === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid latitude and longitude'
      });
    }

    const turfs = await Turf.find({
      isActive: true,
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [normalizedLongitude, normalizedLatitude]
          },
          $maxDistance: normalizedMaxDistance && normalizedMaxDistance > 0 ? normalizedMaxDistance : 5000
        }
      }
    });

    return res.status(200).json({
      success: true,
      count: turfs.length,
      data: turfs
    });
  } catch (error) {
    return sendServerError(res, 'Error fetching nearby turfs', error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id)
      .populate('ownerId', 'name email phone');

    if (!turf) {
      return res.status(404).json({
        success: false,
        message: 'Turf not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: turf
    });
  } catch (error) {
    return sendServerError(res, 'Error fetching turf', error);
  }
});

router.put('/:id', protect, authorizeRoles('admin', 'turf_owner'), async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id);

    if (!turf) {
      return res.status(404).json({
        success: false,
        message: 'Turf not found'
      });
    }

    const { ownerId, _id, ...updates } = req.body;

    const isAdmin = req.user.role === 'admin';
    const isOwner = String(turf.ownerId) === String(req.user._id);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this turf'
      });
    }

    if (updates.sportTypes !== undefined) {
      let normalizedSportTypes;
      try {
        normalizedSportTypes = normalizeSportTypes(updates.sportTypes);
      } catch (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError.message
        });
      }

      if (!normalizedSportTypes) {
        return res.status(400).json({
          success: false,
          message: 'sportTypes must be a non-empty array when provided'
        });
      }

      updates.sportTypes = normalizedSportTypes;
    }

    if (updates.turfSize !== undefined) {
      const normalizedTurfSize = normalizeTurfSize(updates.turfSize);
      if (!normalizedTurfSize) {
        return res.status(400).json({
          success: false,
          message: 'turfSize must include valid numeric length and width'
        });
      }
      updates.turfSize = normalizedTurfSize;
    }

    if (updates.surfaceType !== undefined) {
      const normalizedSurfaceType = String(updates.surfaceType || '').trim().toLowerCase();
      if (!allowedSurfaceTypes.includes(normalizedSurfaceType)) {
        return res.status(400).json({
          success: false,
          message: `surfaceType must be one of: ${allowedSurfaceTypes.join(', ')}`
        });
      }
      updates.surfaceType = normalizedSurfaceType;
    }

    if (updates.basePricingPerSlot !== undefined) {
      const normalizedBasePrice = toFiniteNumber(updates.basePricingPerSlot);
      if (normalizedBasePrice === null || normalizedBasePrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'basePricingPerSlot must be a valid non-negative number'
        });
      }
      updates.basePricingPerSlot = normalizedBasePrice;
    }

    if (updates.location !== undefined) {
      const normalizedLocation = normalizeLocation(updates.location);
      if (!normalizedLocation) {
        return res.status(400).json({
          success: false,
          message: 'location must include valid address, city, state, pincode, latitude and longitude'
        });
      }
      updates.location = normalizedLocation;
    }

    Object.keys(updates).forEach((key) => {
      turf[key] = updates[key];
    });

    turf.updatedAt = new Date();
    await turf.save();

    return res.status(200).json({
      success: true,
      message: 'Turf updated successfully',
      data: turf
    });
  } catch (error) {
    return sendServerError(res, 'Error updating turf', error);
  }
});

router.delete('/:id', protect, authorizeRoles('admin', 'turf_owner'), async (req, res) => {
  try {
    const turf = await Turf.findById(req.params.id);

    if (!turf) {
      return res.status(404).json({
        success: false,
        message: 'Turf not found'
      });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = String(turf.ownerId) === String(req.user._id);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this turf'
      });
    }

    await Turf.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Turf deleted successfully'
    });
  } catch (error) {
    return sendServerError(res, 'Error deleting turf', error);
  }
});

module.exports = router;
