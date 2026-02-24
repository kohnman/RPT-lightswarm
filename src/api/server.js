/**
 * Express API Server
 * REST API for Herescope integration and admin dashboard
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server: SocketServer } = require('socket.io');

const { database } = require('../config');
const loggingMiddleware = require('./middleware/logging');
const validationMiddleware = require('./middleware/validation');

const sessionRoutes = require('./routes/session');
const apartmentsRoutes = require('./routes/apartments');
const floorplatesRoutes = require('./routes/floorplates');
const amenitiesRoutes = require('./routes/amenities');
const adminRoutes = require('./routes/admin');

/**
 * Create and configure the Express server
 * @param {Object} serialConnection - Serial connection instance
 * @param {Object} options - Additional options
 * @param {Object} options.simulator - Light simulator instance
 * @returns {Object} { server, app, io }
 */
async function createServer(serialConnection, options = {}) {
  const app = express();
  const server = http.createServer(app);
  
  const io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  app.locals.serial = serialConnection;
  app.locals.io = io;
  app.locals.simulator = options.simulator || null;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(loggingMiddleware(io));

  app.use(express.static(path.join(__dirname, '../../public')));

  app.use('/api/v1/session', sessionRoutes);
  app.use('/api/v1/apartments', apartmentsRoutes);
  app.use('/api/v1/floorplates', floorplatesRoutes);
  app.use('/api/v1/amenities', amenitiesRoutes);
  app.use('/api/v1/admin', adminRoutes);

  app.get('/api/v1/status', (req, res) => {
    const serialStatus = serialConnection.getStatus();
    const dbStats = database.commandLog.getStats();
    
    res.json({
      status: 'ok',
      version: '1.0.0',
      uptime: process.uptime(),
      serial: serialStatus,
      stats: dbStats,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  app.get('/api/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/api-docs.html'));
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });

  app.use((err, req, res, next) => {
    console.error('API Error:', err);
    
    database.commandLog.add({
      source: 'api',
      commandType: 'error',
      requestData: { path: req.path, method: req.method },
      success: false,
      errorMessage: err.message
    });

    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR'
    });
  });

  io.on('connection', (socket) => {
    console.log('WebSocket client connected:', socket.id);
    
    const recentLogs = database.commandLog.getRecent(50);
    socket.emit('log_history', recentLogs);

    socket.on('disconnect', () => {
      console.log('WebSocket client disconnected:', socket.id);
    });
  });

  return { server, app, io };
}

module.exports = { createServer };
