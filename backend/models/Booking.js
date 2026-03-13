const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    turf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Turf",
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    date: {
      type: String,
      required: true,
      index: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    startMinutes: {
      type: Number,
      required: true
    },
    endMinutes: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    slotHours: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ["booked", "cancelled"],
      default: "booked",
      index: true
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    billing: {
      invoiceNumber: {
        type: String,
        required: true
      },
      currency: {
        type: String,
        default: "INR"
      },
      paymentStatus: {
        type: String,
        enum: ["pending", "paid", "refunded", "failed"],
        default: "pending"
      },
      paymentMethod: {
        type: String,
        enum: ["cash", "upi", "card", "netbanking", "wallet", "other", null],
        default: null
      },
      paymentReference: {
        type: String,
        default: ""
      },
      paidAt: {
        type: Date,
        default: null
      }
    }
  },
  { timestamps: true }
);

bookingSchema.index({ turf: 1, date: 1, startMinutes: 1, endMinutes: 1, status: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
