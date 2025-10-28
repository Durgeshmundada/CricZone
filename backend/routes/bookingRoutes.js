// backend/routes/bookingRoutes.js

const express = require("express");
const {
  createBooking,
  getAllBookings,
  getUserBookings,
  cancelBooking,
} = require("../controllers/bookingController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

// 🟢 Create a booking (User)
router.post("/", protect, createBooking);

// 🟢 Get user's own bookings
router.get("/mybookings", protect, getUserBookings);

// 🟢 Cancel a booking (User or Admin)
router.put("/:id/cancel", protect, cancelBooking);

// 🟢 Get all bookings (Admin only)
router.get("/", protect, admin, getAllBookings);

module.exports = router;
