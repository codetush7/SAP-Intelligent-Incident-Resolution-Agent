require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { initializeMonitoring } = require('./services/monitoringService');
const { setupWebSocket } = require('./services/websocketService');

// Routes
const monitoringRoutes = require('./routes/monitoring');
const ticketRoutes = require('./routes/tickets');
const analysisRoutes = require('./routes/analysis');
const dashboardRoutes = require('./routes/dashboard');
const agentRoutes = require('./routes/agent');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const server = http.createServer(app);

const investigationRoutes = require('./routes/investigation');


// WebSocket Server
const wss = new WebSocket.Server({ server, path: '/ws' });
setupWebSocket(wss);

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// General Middleware
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'SAP CPI Ticketing Agent'
  });
});

// API Routes
<<<<<<< Updated upstream
=======
app.use('/api/auth', authRoutes);
app.use('/api/investigation', investigationRoutes);
>>>>>>> Stashed changes
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`🚀 SAP CPI Ticketing Agent running on port ${PORT}`);
  logger.info(`🌐 WebSocket server active on ws://localhost:${PORT}/ws`);
  
  // Start background monitoring
  if (process.env.NODE_ENV !== 'test') {
    initializeMonitoring();
  }
});

module.exports = { app, server };
