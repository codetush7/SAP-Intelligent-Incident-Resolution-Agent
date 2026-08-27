require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { initDatabase, closeDatabase, getDb } = require('./config/database');
const { initializeMonitoring, stopMonitoring } = require('./services/monitoringService');
const { setupWebSocket } = require('./services/websocketService');

// Routes
const monitoringRoutes = require('./routes/monitoring');
const ticketRoutes = require('./routes/tickets');
const analysisRoutes = require('./routes/analysis');
const dashboardRoutes = require('./routes/dashboard');
const agentRoutes = require('./routes/agent');
const webhookRoutes = require('./routes/webhooks');
const tenantRoutes = require('./routes/tenants');
const jiraRoutes = require('./routes/jira');
const authRoutes = require('./routes/auth');
const investigationRoutes = require('./routes/investigation');

const app = express();
const server = http.createServer(app);

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
  const db = getDb();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'SAP CPI Ticketing Agent',
    database: {
      adapter: db.name,
      connected: db.isConnected()
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/investigation', investigationRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/jira', jiraRoutes);

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

async function startServer() {
  try {
    // 1. Initialize database connection and schema
    await initDatabase();

    // 2. Start HTTP & WebSocket Server
    server.listen(PORT, () => {
      logger.info(`🚀 SAP CPI Ticketing Agent running on port ${PORT}`);
      logger.info(`🌐 WebSocket server active on ws://localhost:${PORT}/ws`);

      // 3. Start background monitoring
      if (process.env.NODE_ENV !== 'test') {
        initializeMonitoring();
      }
    });
  } catch (err) {
    logger.error(`[Server] Startup error: ${err.message}`);
    process.exit(1);
  }
}

// Graceful Shutdown
async function handleShutdown(signal) {
  logger.info(`[Server] Received ${signal}, gracefully shutting down...`);
  stopMonitoring();
  await closeDatabase();
  server.close(() => {
    logger.info('[Server] Server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, server, startServer };