require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/positions', require('./routes/positions'));
app.use('/api/prices',    require('./routes/prices'));
app.use('/api/account',   require('./routes/account'));
app.use('/api/trades',    require('./routes/trades'));
app.use('/api/pp-trades', require('./routes/ppTrades'));
app.use('/api/watchlist', require('./routes/watchlist'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Stock tracker server running on port ${PORT}`));
