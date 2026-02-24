/**
 * Logging Middleware
 * Logs all API requests and emits to WebSocket clients
 */

const { database } = require('../../config');

function loggingMiddleware(io) {
  return (req, res, next) => {
    const startTime = Date.now();

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      const executionTime = Date.now() - startTime;
      
      const logEntry = {
        source: 'api',
        commandType: `${req.method} ${req.path}`,
        targetId: req.params.id || null,
        requestData: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body
        },
        responseData: data,
        success: res.statusCode < 400,
        executionTimeMs: executionTime
      };

      if (req.path.startsWith('/api/v1/')) {
        database.commandLog.add(logEntry);
      }

      io.emit('api_log', {
        ...logEntry,
        timestamp: new Date().toISOString()
      });

      return originalJson(data);
    };

    next();
  };
}

module.exports = loggingMiddleware;
