const Booking = require("../models/Booking");
const Turf = require("../models/Turf");
const User = require("../models/User");

const isProduction = process.env.NODE_ENV === "production";

const sendServerError = (res, message, error) => {
  console.error(`${message}:`, error);
  return res.status(500).json({
    success: false,
    message,
    ...(isProduction ? {} : { error: error.message })
  });
};

exports.createBooking = async (req, res) => {
  try {
    const { turfId, date, startTime, endTime, totalAmount, slotHours, paymentMethod, paymentReference } = req.body;

    const turf = await Turf.findById(turfId);
    if (!turf) {
      return res.status(404).json({ success: false, message: "Turf not found" });
    }

    const startSplit = startTime.split(":");
    const endSplit = endTime.split(":");
    const startMinutes = parseInt(startSplit[0]) * 60 + parseInt(startSplit[1]);
    const endMinutes = parseInt(endSplit[0]) * 60 + parseInt(endSplit[1]);

    const existingBooking = await Booking.findOne({
      turf: turfId,
      date,
      status: "booked",
      $or: [
        { startMinutes: { $lt: endMinutes, $gte: startMinutes } },
        { endMinutes: { $gt: startMinutes, $lte: endMinutes } },
        { startMinutes: { $lte: startMinutes }, endMinutes: { $gte: endMinutes } }
      ]
    });

    if (existingBooking) {
      return res.status(400).json({ success: false, message: "Time slot already booked" });
    }

    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const booking = await Booking.create({
      turf: turfId,
      user: req.user._id,
      date,
      startTime,
      endTime,
      startMinutes,
      endMinutes,
      totalPrice: totalAmount || (turf.basePricingPerSlot * (slotHours || 1)),
      slotHours: slotHours || 1,
      billing: {
        invoiceNumber,
        currency: "INR",
        paymentStatus: paymentMethod ? "paid" : "pending",
        paymentMethod: paymentMethod || null,
        paymentReference: paymentReference || "",
        paidAt: paymentMethod ? new Date() : null
      }
    });

    res.status(201).json({ success: true, message: "Booking created successfully", booking });
  } catch (error) {
    sendServerError(res, "Failed to create booking", error);
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : req.user.role === "turf_owner" ? { turf: { $in: await Turf.find({ ownerId: req.user._id }).select("_id") } } : {};
    const bookings = await Booking.find(query).populate("turf", "turfName location").populate("user", "name email phone").sort({ date: -1, startMinutes: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    sendServerError(res, "Failed to retrieve bookings", error);
  }
};

exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate("turf", "turfName location images").sort({ date: -1, startMinutes: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (error) {
    sendServerError(res, "Failed to retrieve user bookings", error);
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("turf");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    
    if (booking.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = booking.turf.ownerId && booking.turf.ownerId.toString() === req.user._id.toString();
    const isUser = booking.user.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner && !isUser) {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this booking" });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    if (booking.billing.paymentStatus === "paid") {
      booking.billing.paymentStatus = "refunded";
    }
    await booking.save();

    res.json({ success: true, message: "Booking cancelled successfully", booking });
  } catch (error) {
    sendServerError(res, "Failed to cancel booking", error);
  }
};

exports.updateBookingPayment = async (req, res) => {
  try {
    const { paymentStatus, paymentMethod, paymentReference } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (paymentStatus) booking.billing.paymentStatus = paymentStatus;
    if (paymentMethod) booking.billing.paymentMethod = paymentMethod;
    if (paymentReference) booking.billing.paymentReference = paymentReference;
    
    if (paymentStatus === "paid" && !booking.billing.paidAt) {
      booking.billing.paidAt = new Date();
    }

    await booking.save();
    res.json({ success: true, message: "Payment updated", booking });
  } catch (error) {
    sendServerError(res, "Failed to update payment", error);
  }
};

exports.getBillingSummary = async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : req.user.role === "turf_owner" ? { turf: { $in: await Turf.find({ ownerId: req.user._id }).select("_id") } } : { _id: null };
    
    const bookings = await Booking.find({ ...query, status: "booked", "billing.paymentStatus": "paid" });
    
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const bookingsCount = bookings.length;
    
    res.json({ success: true, totalRevenue, bookingsCount });
  } catch (error) {
    sendServerError(res, "Failed to generate billing summary", error);
  }
};

exports.downloadBillingSummaryCsv = async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=billing_summary.csv");
    res.send("Invoice Number,Turf,Date,Amount,Status\nMock,Data,2025-01-01,1000,paid");
  } catch (error) {
    sendServerError(res, "Failed to download summary", error);
  }
};

exports.downloadUserBookingsCsv = async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=my_bookings.csv");
    res.send("Invoice Number,Turf,Date,Amount,Status\nMock,Data,2025-01-01,1000,paid");
  } catch (error) {
    sendServerError(res, "Failed to download bookings", error);
  }
};

module.exports = exports;
