const Turf = require("../models/Turf");

// ➕ Add a new turf (admin only)
exports.addTurf = async (req, res) => {
  try {
    const { name, location, pricePerHour, type, images } = req.body;

    if (!name || !location || !pricePerHour) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const turf = await Turf.create({
      name,
      location,
      pricePerHour,
      type,
      images,
    });

    res.status(201).json({ message: "Turf added successfully ✅", turf });
  } catch (error) {
    console.error("❌ Turf error:", error);
    res.status(500).json({ message: error.message });
  }
};

// 🧾 Get all turfs
exports.getAllTurfs = async (req, res) => {
  try {
    const turfs = await Turf.find();
    res.json(turfs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
