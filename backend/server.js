require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./src/routes/authRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'https://codeinsight-roan.vercel.app', 'https://codeinsight-roan.vercel.app'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT',
      },
    });
  },
});
app.use(limiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CodeInsight API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/review', reviewRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`CodeInsight server running on port ${PORT}`);
});
