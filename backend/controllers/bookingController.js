const asyncHandler = require('express-async-handler');
const Booking = require('../models/Booking');
const Turf = require('../models/Turf');

const normalizeTimeToMinutes = (time) => {
  const value = String(time || "").trim();
  if (!value) return null;

  const normalized = value
    .toUpperCase()
    .replace(/\s+/g, "");

  const hasMeridiem = normalized.endsWith("AM") || normalized.endsWith("PM");
  const timePart = hasMeridiem ? normalized.slice(0, -2) : normalized;
  const meridiem = hasMeridiem ? normalized.slice(-2) : null;

  const [rawHour, rawMinute = "0"] = timePart.split(":");
  let hour = parseInt(rawHour, 10);
  const minute = parseInt(rawMinute, 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem === "AM") {
    if (hour === 12) hour = 0;
  } else if (meridiem === "PM") {
    if (hour < 12) hour += 12;
  }

  if (hour < 0 || hour > 23) return null;
  return (hour * 60) + minute;
};

const calculateDurationHours = (startMinutes, endMinutes) => {
  if (endMinutes <= startMinutes) return 0;
  return Number(((endMinutes - startMinutes) / 60).toFixed(2));
};

const hasTimeConflict = (aStart, aEnd, bStart, bEnd) => {
  return aStart < bEnd && bStart < aEnd;
};

exports.createBooking = async (req, res) => {
  try {
    const { turfId, date, startTime, endTime } = req.body;

    if (!turfId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "turfId, date, startTime and endTime are required"
      });
    }

    const turf = await Turf.findById(turfId);
    if (!turf || turf.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Turf not found"
      });
    }

    const startMinutes = normalizeTimeToMinutes(startTime);
    const endMinutes = normalizeTimeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format. Use HH:MM or HH:MM AM/PM."
      });
    }

    const durationHours = calculateDurationHours(startMinutes, endMinutes);
    if (durationHours <= 0) {
      return res.status(400).json({
        success: false,
        message: "endTime must be greater than startTime"
      });
    }

    const sameDayBookings = await Booking.find({
      turf: turfId,
      date,
      status: "booked"
    }).select("startTime endTime");

    const conflict = sameDayBookings.some((booking) => {
      const bookingStart = normalizeTimeToMinutes(booking.startTime);
      const bookingEnd = normalizeTimeToMinutes(booking.endTime);
      if (bookingStart === null || bookingEnd === null) return false;
      return hasTimeConflict(startMinutes, endMinutes, bookingStart, bookingEnd);
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "Selected time slot is already booked"
      });
    }

    const rate = Number(turf.basePricingPerSlot || 0);
    const totalPrice = Number((rate * durationHours).toFixed(2));

    const booking = await Booking.create({
      turf: turfId,
      user: req.user._id,
      date,
      startTime,
      endTime,
      totalPrice
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking
    });
  } catch (error) {
    console.error("Booking creation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }

exports.getAllBookings = async (_req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("turf", "turfName location")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings"
    });
  }

exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("turf", "turfName location basePricingPerSlot sportTypes")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error("Failed to fetch user bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your bookings"
    });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const canCancel =
      booking.user.toString() === req.user._id.toString() ||
      req.user.role === "admin";

    if (!canCancel) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this booking"
      });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled"
      });
    }

    booking.status = "cancelled";
    await booking.save();

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel booking"
    });
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

module.exports = exports;
