const playerStatsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  playerName: String,
  batting: {
    matches: { type: Number, default: 0 },
    innings: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    average: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 },
    centuries: { type: Number, default: 0 },
    fifties: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 }
  },
  bowling: {
    matches: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    bestFigures: String,
    average: { type: Number, default: 0 },
    economy: { type: Number, default: 0 },
    fiveWickets: { type: Number, default: 0 }
  },
  overall: {
    manOfTheMatch: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 }
  }
});
