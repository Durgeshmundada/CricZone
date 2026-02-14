const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    turf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Turf",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String, // Example: "2025-10-28"
      required: true,
    },
    startTime: {
      type: String, // Example: "08:00 AM"
      required: true,
    },
    endTime: {
      type: String, // Example: "09:00 AM"
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    slotHours: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["booked", "cancelled"],
      default: "booked",
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    billing: {
      invoiceNumber: {
        type: String,
        required: true,
      },
      currency: {
        type: String,
        default: "INR",
      },
      paymentStatus: {
        type: String,
        enum: ["pending", "paid", "refunded", "failed"],
        default: "pending",
      },
      paymentMethod: {
        type: String,
        enum: ["cash", "upi", "card", "netbanking", "wallet", "other", null],
        default: null,
      },
      paymentReference: {
        type: String,
        default: "",
      },
      paidAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
