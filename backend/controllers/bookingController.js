const Booking = require("../models/Booking");
const Turf = require("../models/Turf");

const VALID_PAYMENT_STATUSES = new Set(["pending", "paid", "refunded", "failed"]);
const VALID_PAYMENT_METHODS = new Set(["cash", "upi", "card", "netbanking", "wallet", "other"]);

const normalizeTimeToMinutes = (time) => {
  const value = String(time || "").trim();
  if (!value) return null;

  const normalized = value.toUpperCase().replace(/\s+/g, "");
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

const hasTimeConflict = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

const buildInvoiceNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${timestamp}-${random}`;
};

const ensureBillingDefaults = (booking) => {
  if (!booking.billing) {
    booking.billing = {};
  }
  if (!booking.billing.invoiceNumber) {
    booking.billing.invoiceNumber = buildInvoiceNumber();
  }
  if (!booking.billing.currency) {
    booking.billing.currency = "INR";
  }
  if (!booking.billing.paymentStatus) {
    booking.billing.paymentStatus = "pending";
  }
  if (booking.billing.paymentMethod === undefined) {
    booking.billing.paymentMethod = null;
  }
  if (!booking.billing.paymentReference) {
    booking.billing.paymentReference = "";
  }
};

const parseRangeDate = (value, fallbackEndOfDay = false) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  if (fallbackEndOfDay) {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }
  return parsed;
};

const parseDateRange = (query = {}) => {
  const from = parseRangeDate(query.from, false);
  const to = parseRangeDate(query.to, true);

  const createdAt = {};
  if (from) createdAt.$gte = from;
  if (to) createdAt.$lte = to;

  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
};

const asCsvValue = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const makeBillingQuery = async (req, includeTurfFilter = true) => {
  const query = {
    ...parseDateRange(req.query)
  };

  const requestedTurfId = includeTurfFilter && req.query.turfId ? String(req.query.turfId) : null;
  if (requestedTurfId) query.turf = requestedTurfId;

  if (req.user.role === "admin") {
    return query;
  }

  if (req.user.role === "turf_owner") {
    const ownedTurfs = await Turf.find({ ownerId: req.user._id }).select("_id");
    const turfIds = ownedTurfs.map((turf) => String(turf._id));
    if (requestedTurfId) {
      if (!turfIds.includes(requestedTurfId)) {
        query._id = null;
      } else {
        query.turf = requestedTurfId;
      }
    } else {
      query.turf = { $in: turfIds };
    }
    return query;
  }

  query.user = req.user._id;
  return query;
};

const userCanManageBooking = (req, booking, turf) => {
  const isAdmin = req.user.role === "admin";
  const isUserBookingOwner = String(booking.user) === String(req.user._id);
  const isTurfOwner = req.user.role === "turf_owner" && turf && String(turf.ownerId) === String(req.user._id);
  return isAdmin || isUserBookingOwner || isTurfOwner;
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
      slotHours: durationHours,
      totalPrice,
      billing: {
        invoiceNumber: buildInvoiceNumber(),
        currency: "INR",
        paymentStatus: "pending",
        paymentMethod: null,
        paymentReference: "",
        paidAt: null
      }
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking
    });
  } catch (error) {
    console.error("Booking creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const query = await makeBillingQuery(req);
    const bookings = await Booking.find(query)
      .populate("turf", "turfName location ownerId")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings"
    });
  }
};

exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("turf", "turfName location basePricingPerSlot sportTypes")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error("Failed to fetch user bookings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your bookings"
    });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("turf", "ownerId");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const turf = booking.turf;
    if (!userCanManageBooking(req, booking, turf)) {
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

    ensureBillingDefaults(booking);
    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    if (booking.billing && booking.billing.paymentStatus === "paid") {
      booking.billing.paymentStatus = "refunded";
    }

    await booking.save();

    return res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking"
    });
  }
};

exports.updateBookingPayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("turf", "ownerId");
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const turf = booking.turf;
    const isAdmin = req.user.role === "admin";
    const isOwner = req.user.role === "turf_owner" && turf && String(turf.ownerId) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Only admin or turf owner can update payment status"
      });
    }

    ensureBillingDefaults(booking);

    const status = String(req.body.paymentStatus || "").toLowerCase();
    if (!VALID_PAYMENT_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        message: "paymentStatus must be one of: pending, paid, refunded, failed"
      });
    }

    let method = req.body.paymentMethod;
    if (method !== undefined && method !== null && String(method).trim() !== "") {
      method = String(method).toLowerCase().trim();
      if (!VALID_PAYMENT_METHODS.has(method)) {
        return res.status(400).json({
          success: false,
          message: "paymentMethod must be one of: cash, upi, card, netbanking, wallet, other"
        });
      }
    } else {
      method = null;
    }

    booking.billing = booking.billing || {};
    booking.billing.paymentStatus = status;
    booking.billing.paymentMethod = method;
    booking.billing.paymentReference = String(req.body.paymentReference || "").trim();
    booking.billing.paidAt = status === "paid" ? new Date() : null;

    await booking.save();

    return res.json({
      success: true,
      message: "Payment status updated",
      booking
    });
  } catch (error) {
    console.error("Payment update error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update payment status"
    });
  }
};

exports.getBillingSummary = async (req, res) => {
  try {
    if (!["admin", "turf_owner"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or turf owner can view billing summary"
      });
    }

    const query = await makeBillingQuery(req);
    const bookings = await Booking.find(query)
      .populate("turf", "turfName ownerId")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const totals = bookings.reduce(
      (acc, booking) => {
        const amount = Number(booking.totalPrice || 0);
        const paymentStatus = String(booking.billing?.paymentStatus || "pending");
        const status = String(booking.status || "booked");

        if (status === "cancelled") {
          acc.cancelledCount += 1;
        } else {
          acc.bookedCount += 1;
        }

        if (paymentStatus === "paid") {
          acc.paidCount += 1;
          acc.totalPaid += amount;
        } else if (paymentStatus === "pending") {
          acc.pendingPaymentCount += 1;
          acc.totalPending += amount;
        } else if (paymentStatus === "refunded") {
          acc.refundedCount += 1;
          acc.totalRefunded += amount;
        } else if (paymentStatus === "failed") {
          acc.failedPaymentCount += 1;
        }

        acc.grossBooked += amount;
        return acc;
      },
      {
        bookedCount: 0,
        cancelledCount: 0,
        paidCount: 0,
        pendingPaymentCount: 0,
        refundedCount: 0,
        failedPaymentCount: 0,
        grossBooked: 0,
        totalPaid: 0,
        totalPending: 0,
        totalRefunded: 0
      }
    );

    return res.json({
      success: true,
      filters: {
        from: req.query.from || null,
        to: req.query.to || null,
        turfId: req.query.turfId || null
      },
      summary: totals,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error("Billing summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch billing summary"
    });
  }
};

exports.downloadBillingSummaryCsv = async (req, res) => {
  try {
    if (!["admin", "turf_owner"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or turf owner can download billing summary"
      });
    }

    const query = await makeBillingQuery(req);
    const bookings = await Booking.find(query)
      .populate("turf", "turfName")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const header = [
      "invoice_number",
      "created_at",
      "booking_status",
      "payment_status",
      "payment_method",
      "payment_reference",
      "user_name",
      "user_email",
      "turf_name",
      "date",
      "start_time",
      "end_time",
      "slot_hours",
      "amount",
      "currency"
    ];

    const rows = bookings.map((booking) => [
      booking.billing?.invoiceNumber || "",
      booking.createdAt ? new Date(booking.createdAt).toISOString() : "",
      booking.status || "",
      booking.billing?.paymentStatus || "pending",
      booking.billing?.paymentMethod || "",
      booking.billing?.paymentReference || "",
      booking.user?.name || "",
      booking.user?.email || "",
      booking.turf?.turfName || "",
      booking.date || "",
      booking.startTime || "",
      booking.endTime || "",
      Number(booking.slotHours || 0).toFixed(2),
      Number(booking.totalPrice || 0).toFixed(2),
      booking.billing?.currency || "INR"
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(asCsvValue).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="billing-report-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Billing CSV error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download billing report"
    });
  }
};

exports.downloadUserBookingsCsv = async (req, res) => {
  try {
    const query = {
      user: req.user._id,
      ...parseDateRange(req.query)
    };

    const bookings = await Booking.find(query)
      .populate("turf", "turfName")
      .sort({ createdAt: -1 });

    const header = [
      "invoice_number",
      "created_at",
      "booking_status",
      "payment_status",
      "payment_method",
      "turf_name",
      "date",
      "start_time",
      "end_time",
      "slot_hours",
      "amount",
      "currency"
    ];

    const rows = bookings.map((booking) => [
      booking.billing?.invoiceNumber || "",
      booking.createdAt ? new Date(booking.createdAt).toISOString() : "",
      booking.status || "",
      booking.billing?.paymentStatus || "pending",
      booking.billing?.paymentMethod || "",
      booking.turf?.turfName || "",
      booking.date || "",
      booking.startTime || "",
      booking.endTime || "",
      Number(booking.slotHours || 0).toFixed(2),
      Number(booking.totalPrice || 0).toFixed(2),
      booking.billing?.currency || "INR"
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(asCsvValue).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="my-bookings-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error("User bookings CSV error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download your bookings report"
    });
  }
};

module.exports = exports;
