const Booking = require("../models/Booking");
const Turf = require("../models/Turf");

// ✅ Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const { turfId, date, startTime, endTime } = req.body;

    const turf = await Turf.findById(turfId);
    if (!turf) {
      return res.status(404).json({ message: "Turf not found" });
    }

    const totalPrice = turf.pricePerHour;

    const booking = await Booking.create({
      turf: turfId,
      user: req.user._id,
      date,
      startTime,
      endTime,
      totalPrice,
    });

    res.status(201).json({
      message: "Booking successful ✅",
      booking,
    });
  } catch (error) {
    console.error("❌ Booking Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ✅ Get all bookings (Admin)
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("turf", "name location")
      .populate("user", "name email");

    res.json({ count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings", error });
  }
};

// ✅ Get user’s own bookings
// ✅ Get user’s own bookings
exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("turf", "name location pricePerHour type");

    res.status(200).json({
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("❌ Error fetching user bookings:", error);
    res.status(500).json({ message: "Failed to fetch your bookings" });
  }
};
// ✅ Cancel a booking
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // User can only cancel their own booking
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to cancel this booking" });
    }

    booking.status = "cancelled";
    await booking.save();

    res.json({ message: "Booking cancelled successfully ❌", booking });
  } catch (error) {
    console.error("❌ Cancel booking error:", error);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
};
