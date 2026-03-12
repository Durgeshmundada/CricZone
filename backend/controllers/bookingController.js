const Booking = require("../models/Booking");
const Turf = require("../models/Turf");
const { asyncHandler, createError, sendSuccess } = require("../utils/http");
const { formatMinutes, isIsoDate, parseTimeInput } = require("../utils/time");
const { presentTurf } = require("../utils/presenters");

const buildInvoiceNumber = () => `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const presentBooking = (booking) => ({
  _id: booking._id,
  turf: booking.turf?.turfName ? presentTurf(booking.turf) : booking.turf,
  user: booking.user,
  date: booking.date,
  startTime: booking.startTime,
  endTime: booking.endTime,
  totalPrice: Number(booking.totalPrice || 0),
  status: booking.status,
  billing: booking.billing,
  createdAt: booking.createdAt,
  updatedAt: booking.updatedAt
});

const toLocalIsoDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const buildDateFilter = (from, to) => {
  const filter = {};
  if (isIsoDate(from)) {
    filter.$gte = from;
  }
  if (isIsoDate(to)) {
    filter.$lte = to;
  }
  return Object.keys(filter).length > 0 ? filter : null;
};

const buildCsv = (rows = []) =>
  rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

const buildBookingsCsv = (bookings = []) =>
  buildCsv([
    [
      "Invoice",
      "Turf",
      "Booked By",
      "Date",
      "Start Time",
      "End Time",
      "Amount",
      "Booking Status",
      "Payment Status",
      "Payment Method"
    ],
    ...bookings.map((booking) => [
      booking?.billing?.invoiceNumber || "",
      booking?.turf?.turfName || booking?.turf?.name || "",
      booking?.user?.name || booking?.user?.email || "",
      booking?.date || "",
      booking?.startTime || "",
      booking?.endTime || "",
      Number(booking?.totalPrice || 0).toFixed(2),
      booking?.status || "",
      booking?.billing?.paymentStatus || "",
      booking?.billing?.paymentMethod || ""
    ])
  ]);

const getTurfOwnerScope = async (user) => {
  if (user.role !== "turf_owner") {
    return null;
  }

  const turfs = await Turf.find({
    ownerId: user._id,
    isActive: true
  }).select("_id");

  return turfs.map((turf) => turf._id);
};

const applyOwnerScope = async (query, user) => {
  if (user.role !== "turf_owner") {
    return query;
  }

  const turfIds = await getTurfOwnerScope(user);
  return {
    ...query,
    turf: { $in: turfIds }
  };
};

const fetchBookings = async (query) =>
  Booking.find(query)
    .sort({ date: 1, startMinutes: 1 })
    .populate("turf", "turfName name location pricePerHour basePricingPerSlot images ownerId")
    .populate("user", "name email");

exports.createBooking = asyncHandler(async (req, res) => {
  const turfId = String(req.body.turfId || "").trim();
  const date = String(req.body.date || "").trim();
  const startTimeRaw = String(req.body.startTime || "").trim();
  const endTimeRaw = String(req.body.endTime || "").trim();

  if (!turfId || !isIsoDate(date) || !startTimeRaw || !endTimeRaw) {
    throw createError(400, "Turf, booking date, start time, and end time are required");
  }

  const startMinutes = parseTimeInput(startTimeRaw);
  const endMinutes = parseTimeInput(endTimeRaw);
  if (startMinutes === null || endMinutes === null) {
    throw createError(400, "Please provide time in HH:MM or HH:MM AM/PM format");
  }
  if (endMinutes <= startMinutes) {
    throw createError(400, "End time must be after start time");
  }

  const today = toLocalIsoDate();
  if (date < today) {
    throw createError(400, "Booking date cannot be in the past");
  }
  if (date === today) {
    const now = new Date();
    const nowMinutes = (now.getHours() * 60) + now.getMinutes();
    if (startMinutes <= nowMinutes) {
      throw createError(400, "Booking start time must be in the future");
    }
  }

  const turf = await Turf.findById(turfId);
  if (!turf || turf.isActive === false) {
    throw createError(404, "Turf not found");
  }

  const overlappingBooking = await Booking.findOne({
    turf: turf._id,
    date,
    status: "booked",
    $or: [
      { startMinutes: { $lt: endMinutes, $gte: startMinutes } },
      { endMinutes: { $gt: startMinutes, $lte: endMinutes } },
      {
        startMinutes: { $lte: startMinutes },
        endMinutes: { $gte: endMinutes }
      }
    ]
  });

  if (overlappingBooking) {
    throw createError(409, "Selected turf slot is already booked");
  }

  const durationHours = (endMinutes - startMinutes) / 60;
  const hourlyPrice = Number(turf.pricePerHour || turf.basePricingPerSlot || 0);
  const totalPrice = Number((durationHours * hourlyPrice).toFixed(2));

  const booking = await Booking.create({
    turf: turf._id,
    user: req.user._id,
    date,
    startTime: formatMinutes(startMinutes),
    endTime: formatMinutes(endMinutes),
    startMinutes,
    endMinutes,
    totalPrice,
    billing: {
      invoiceNumber: buildInvoiceNumber(),
      paymentStatus: "pending",
      paymentMethod: ""
    }
  });

  await booking.populate("turf user", "turfName name location pricePerHour email ownerId");

  return sendSuccess(res, {
    message: "Booking successful",
    booking: presentBooking(booking)
  }, 201);
});

exports.getAllBookings = asyncHandler(async (req, res) => {
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  const query = {};
  if (dateFilter) {
    query.date = dateFilter;
  }

  const bookings = await fetchBookings(query);

  return sendSuccess(res, {
    count: bookings.length,
    bookings: bookings.map(presentBooking),
    data: bookings.map(presentBooking)
  });
});

exports.getUserBookings = asyncHandler(async (req, res) => {
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  const query = { user: req.user._id };
  if (dateFilter) {
    query.date = dateFilter;
  }

  const bookings = await fetchBookings(query);

  return sendSuccess(res, {
    count: bookings.length,
    bookings: bookings.map(presentBooking),
    data: bookings.map(presentBooking),
    summary: {
      totalBookings: bookings.length,
      totalPaid: bookings
        .filter((booking) => booking.billing?.paymentStatus === "paid")
        .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0),
      totalPending: bookings
        .filter((booking) => booking.billing?.paymentStatus !== "paid")
        .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0)
    }
  });
});

exports.downloadUserBookingsReport = asyncHandler(async (req, res) => {
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  const query = { user: req.user._id };
  if (dateFilter) {
    query.date = dateFilter;
  }

  const bookings = await fetchBookings(query);
  const csv = buildBookingsCsv(bookings);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="my-bookings-${Date.now()}.csv"`);
  return res.status(200).send(csv);
});

exports.cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate("turf user", "turfName name email ownerId");
  if (!booking) {
    throw createError(404, "Booking not found");
  }

  const isOwner = String(booking.user?._id || booking.user) === String(req.user._id);
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw createError(403, "Not authorized to cancel this booking");
  }

  if (booking.status === "cancelled") {
    throw createError(400, "Booking is already cancelled");
  }

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  await booking.save();

  return sendSuccess(res, {
    message: "Booking cancelled successfully",
    booking: presentBooking(booking)
  });
});

exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const paymentStatus = String(req.body.paymentStatus || "").trim().toLowerCase();
  const paymentMethod = String(req.body.paymentMethod || "").trim().toLowerCase();

  if (!["pending", "paid", "refunded", "failed"].includes(paymentStatus)) {
    throw createError(400, "Invalid payment status");
  }

  const booking = await Booking.findById(req.params.id).populate("turf user", "turfName name email ownerId");
  if (!booking) {
    throw createError(404, "Booking not found");
  }

  if (
    req.user.role === "turf_owner" &&
    String(booking.turf?.ownerId || "") !== String(req.user._id)
  ) {
    throw createError(403, "Not authorized to update payments for this turf");
  }

  booking.billing.paymentStatus = paymentStatus;
  booking.billing.paymentMethod = paymentMethod;
  booking.billing.paidAt = paymentStatus === "paid" ? new Date() : null;
  await booking.save();

  return sendSuccess(res, {
    message: "Payment status updated",
    booking: presentBooking(booking)
  });
});

exports.getBillingSummary = asyncHandler(async (req, res) => {
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  const baseQuery = {};
  if (dateFilter) {
    baseQuery.date = dateFilter;
  }

  const query = await applyOwnerScope(baseQuery, req.user);
  const bookings = await fetchBookings(query);

  const summary = {
    bookedCount: bookings.filter((booking) => booking.status === "booked").length,
    cancelledCount: bookings.filter((booking) => booking.status === "cancelled").length,
    totalPaid: bookings
      .filter((booking) => booking.billing?.paymentStatus === "paid")
      .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0),
    totalPending: bookings
      .filter((booking) => booking.billing?.paymentStatus === "pending")
      .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0),
    totalRefunded: bookings
      .filter((booking) => booking.billing?.paymentStatus === "refunded")
      .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0),
    grossBooked: bookings.reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0)
  };

  return sendSuccess(res, {
    summary,
    bookings: bookings.map(presentBooking)
  });
});

exports.downloadBillingReport = asyncHandler(async (req, res) => {
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  const baseQuery = {};
  if (dateFilter) {
    baseQuery.date = dateFilter;
  }

  const query = await applyOwnerScope(baseQuery, req.user);
  const bookings = await fetchBookings(query);
  const csv = buildBookingsCsv(bookings);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="billing-report-${Date.now()}.csv"`);
  return res.status(200).send(csv);
});
