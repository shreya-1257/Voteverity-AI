/* =====================================================================
   VoteVerity AI – Backend Server
   Express.js, MySQL, Sequelize ORM & REST API
   ===================================================================== */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { connectDB } = require('./config/database');
const seedDatabase = require('./seeders/seed');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const electionRoutes = require('./routes/electionRoutes');
const voteRoutes = require('./routes/voteRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows existing inline scripts and styles in index.html
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body parsers (with 10mb limit for optional student photo uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all /api/ endpoints
app.use('/api/', generalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/election', electionRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/ai', aiRoutes);

// System Health Check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'VoteVerity AI backend server running',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static files
app.use(express.static(__dirname));

// Fallback to index.html for frontend navigation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Centralized Error Handler Middleware
app.use(errorHandler);

// Start server after connecting to database
const startServer = async () => {
  try {
    await connectDB();
    await seedDatabase();

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 VoteVerity AI server running on port: ${PORT}`);
      console.log(`📡 Local URL: http://localhost:${PORT}`);
      console.log(`📊 Health Endpoint: http://localhost:${PORT}/health`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
