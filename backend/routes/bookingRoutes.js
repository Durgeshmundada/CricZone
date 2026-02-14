const express = require("express");
const {
  createBooking,
  getAllBookings,
  getUserBookings,
  cancelBooking
} = require("../controllers/bookingController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

// Create booking (authenticated user)
router.post("/", protect, createBooking);

// Get current user bookings
router.get("/mybookings", protect, getUserBookings);

// Cancel booking (owner or admin)
router.put("/:id/cancel", protect, cancelBooking);

// Get all bookings (admin only)
router.get("/", protect, admin, getAllBookings);

module.exports = router;
