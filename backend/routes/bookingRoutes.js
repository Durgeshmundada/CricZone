const express = require("express");
const {
  createBooking,
  getAllBookings,
  getUserBookings,
  downloadUserBookingsReport,
  cancelBooking,
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

module.exports = router;
