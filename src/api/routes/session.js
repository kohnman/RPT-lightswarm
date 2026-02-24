/**
 * Session Routes
 * Handles login/logout and ambient state control
 */

const express = require('express');
const router = express.Router();
const { database } = require('../../config');
const mdp = require('../../mdp');

let animationEngine = null;

function setAnimationEngine(engine) {
  animationEngine = engine;
}

/**
 * POST /api/v1/session/login
 * Agent logs in - stop ambient animation, fade down from top to bottom
 */
router.post('/login', async (req, res, next) => {
  try {
    const { agentId } = req.body;
    const serial = req.app.locals.serial;
    const io = req.app.locals.io;

    database.sessionLog.add('login', agentId);

    if (animationEngine) {
      animationEngine.stopAmbient();
    }

    const fadeDelayMs = parseInt(database.settings.get('login_fade_delay_ms') || '100', 10);
    const fadeTimeMs = parseInt(database.settings.get('default_fade_time_ms') || '500', 10);

    const { max_floor, min_floor } = database.apartments.getFloorRange();
    
    for (let floor = max_floor; floor >= min_floor; floor--) {
      const apartments = database.apartments.getByFloor(null, floor);
      
      for (const apt of apartments) {
        const fadeParams = mdp.calculateFadeParams(255, 0, fadeTimeMs);
        const packet = mdp.packetFade(apt.lightswarm_address, 0, fadeParams.interval, fadeParams.step);
        await serial.send(packet);
      }

      const amenities = database.amenities.getByFloor(null, floor);
      for (const amenity of amenities) {
        const fadeParams = mdp.calculateFadeParams(255, 0, fadeTimeMs);
        const packet = mdp.packetFade(amenity.lightswarm_address, 0, fadeParams.interval, fadeParams.step);
        await serial.send(packet);
      }

      if (floor > min_floor) {
        await new Promise(resolve => setTimeout(resolve, fadeDelayMs));
      }
    }

    io.emit('session_event', { type: 'login', agentId, timestamp: new Date().toISOString() });

    res.json({
      success: true,
      message: 'Login successful, ambient animation stopped',
      agentId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/session/logout
 * Agent logs out - start ambient animation
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { agentId } = req.body;
    const io = req.app.locals.io;

    database.sessionLog.add('logout', agentId);

    if (animationEngine) {
      animationEngine.startAmbient();
    }

    io.emit('session_event', { type: 'logout', agentId, timestamp: new Date().toISOString() });

    res.json({
      success: true,
      message: 'Logout successful, ambient animation started',
      agentId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/session/status
 * Get current session status
 */
router.get('/status', (req, res) => {
  const recentSessions = database.sessionLog.getRecent(10);
  const lastLogin = recentSessions.find(s => s.event_type === 'login');
  const lastLogout = recentSessions.find(s => s.event_type === 'logout');

  const isActive = lastLogin && (!lastLogout || new Date(lastLogin.timestamp) > new Date(lastLogout.timestamp));

  res.json({
    isActive,
    ambientRunning: animationEngine ? animationEngine.isRunning() : false,
    lastLogin: lastLogin || null,
    lastLogout: lastLogout || null
  });
});

module.exports = router;
module.exports.setAnimationEngine = setAnimationEngine;
