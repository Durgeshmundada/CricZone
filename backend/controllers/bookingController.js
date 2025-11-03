const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Turf = require('../models/Turf');

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = asyncHandler(async (req, res) => {
  const { turfId, date, startTime, endTime } = req.body;
  const userId = req.user._id;

  if (!turfId || !date || !startTime || !endTime) {
    res.status(400);
    throw new Error('Please provide all booking details');
  }

  const turf = await Turf.findById(turfId);
  if (!turf) {
    res.status(404);
    throw new Error('Turf not found');
  }

  // TODO: Add logic to check for overlapping bookings

  // Simple price calculation (e.g., 1 hour = pricePerHour)
  // A real app would calculate duration
  const totalPrice = turf.pricePerHour;

  const booking = await Booking.create({
    user: userId,
    turf: turfId,
    date,
    startTime,
    endTime,
    totalPrice,
    status: 'Confirmed',
  });

  res.status(201).json(booking);
});

// @desc    Get logged in user's bookings
// @route   GET /api/bookings/mybookings
// @access  Private
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate('turf', 'name location') // Get turf name and location
    .sort({ date: -1 }); // Newest first

  res.status(200).json({ bookings });
});

// @desc    Get all bookings (admin)
// @route   GET /api/bookings
// @access  Private/Admin
const getAllBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find()
    .populate('user', 'name email') // Show user name and email
    .populate('turf', 'name location')
    .sort({ date: -1 });

  res.status(200).json({ bookings });
});

// @desc    Get bookings for a specific user (admin)
// @route   GET /api/bookings/user/:userId
// @access  Private/Admin
const getUserBookings = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const bookings = await Booking.find({ user: userId })
    .populate('turf', 'name location')
    .sort({ date: -1 });

  res.status(200).json({ bookings });
});

// @desc    Cancel a booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  booking.status = 'Cancelled';
  await booking.save();

  res.status(200).json({ message: 'Booking cancelled' });
});

module.exports = {
  createBooking,
  getMyBookings,
  getAllBookings,
  getUserBookings,
  cancelBooking,
};
