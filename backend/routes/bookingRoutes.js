const express = require("express");
const {
  createBooking,
  getAllBookings,
  getUserBookings,
  cancelBooking,
  updateBookingPayment,
  getBillingSummary,
  downloadBillingSummaryCsv,
  downloadUserBookingsCsv
} = require("../controllers/bookingController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const schemas = require("../validation/schemas");

const router = express.Router();

// Create booking (authenticated user)
router.post("/", protect, validate(schemas.createBooking), createBooking);

// Get current user bookings
router.get("/mybookings", protect, getUserBookings);
router.get("/mybookings/report.csv", protect, downloadUserBookingsCsv);

// Cancel booking (owner or admin)
router.put("/:id/cancel", protect, validate(schemas.bookingIdParam), cancelBooking);

// Get all bookings (admin/turf owner filtered by role)
router.get("/", protect, authorizeRoles("admin", "turf_owner"), getAllBookings);

// Billing summary and report download
router.get("/billing/summary", protect, authorizeRoles("admin", "turf_owner"), getBillingSummary);
router.get("/billing/report.csv", protect, authorizeRoles("admin", "turf_owner"), downloadBillingSummaryCsv);

// Update payment status for a booking
router.put("/:id/payment", protect, authorizeRoles("admin", "turf_owner"), validate(schemas.updateBookingPayment), updateBookingPayment);

module.exports = router;
