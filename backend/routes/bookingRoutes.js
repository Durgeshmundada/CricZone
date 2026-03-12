const express = require("express");
const {
  createBooking,
  getAllBookings,
  getUserBookings,
  downloadUserBookingsReport,
  cancelBooking,
<<<<<<< HEAD
  updatePaymentStatus,
  getBillingSummary,
  downloadBillingReport
} = require("../controllers/bookingController");
const { protect, admin, adminOrTurfOwner } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createBooking);
router.get("/mybookings", protect, getUserBookings);
router.get("/mybookings/report.csv", protect, downloadUserBookingsReport);
router.get("/billing/summary", protect, adminOrTurfOwner, getBillingSummary);
router.get("/billing/report.csv", protect, adminOrTurfOwner, downloadBillingReport);
router.put("/:id/payment", protect, adminOrTurfOwner, updatePaymentStatus);
router.put("/:id/cancel", protect, cancelBooking);
router.get("/", protect, admin, getAllBookings);
=======
  updateBookingPayment,
  getBillingSummary,
  downloadBillingSummaryCsv,
  downloadUserBookingsCsv
} = require("../controllers/bookingController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// Create booking (authenticated user)
router.post("/", protect, createBooking);

// Get current user bookings
router.get("/mybookings", protect, getUserBookings);
router.get("/mybookings/report.csv", protect, downloadUserBookingsCsv);

// Cancel booking (owner or admin)
router.put("/:id/cancel", protect, cancelBooking);

// Get all bookings (admin/turf owner filtered by role)
router.get("/", protect, authorizeRoles("admin", "turf_owner"), getAllBookings);

// Billing summary and report download
router.get("/billing/summary", protect, authorizeRoles("admin", "turf_owner"), getBillingSummary);
router.get("/billing/report.csv", protect, authorizeRoles("admin", "turf_owner"), downloadBillingSummaryCsv);

// Update payment status for a booking
router.put("/:id/payment", protect, authorizeRoles("admin", "turf_owner"), updateBookingPayment);
>>>>>>> 9a56d599cc7a5ec62e038b572a2785508031f878

module.exports = router;
