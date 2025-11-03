const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User'); // <--- 1. FIXED PATH AND FILENAME

// Load .env variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
app.use(cors()); 
app.use(express.json()); // This line should already be here

// --- ROUTES ---
app.get('/', (req, res) => {
  res.send('API is running...');
});

// 2. REMOVED THE HARDCODED REGISTER ROUTE.
// We will use the router file instead.

// 3. ADD YOUR ROUTER FILES SO THAT LOGIN AND REGISTER BOTH WORK
// These lines will find your backend/routes/userRoutes.js file.
app.use('/api/users', require('./routes/userRoutes')); 
app.use('/api/matches', require('./routes/matchRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/turfs', require('./routes/turfRoutes'));
app.use('/api/tournaments', require('./routes/tournamentRoutes'));
// Add other routes as needed...


// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
