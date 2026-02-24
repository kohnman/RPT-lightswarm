/**
 * River Park Towers LightSwarm Middleware
 * Main Entry Point
 */

console.log('[STARTUP] Loading modules...');
console.log('[STARTUP] NODE_ENV:', process.env.NODE_ENV);
console.log('[STARTUP] PORT:', process.env.PORT);
console.log('[STARTUP] SIMULATION_MODE:', process.env.SIMULATION_MODE);

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  process.exit(1);
});

const path = require('path');
const { database } = require('./config');
const mdp = require('./mdp');
const LightSimulator = require('./simulator');

const APP_NAME = 'RiverPark LightSwarm Middleware';
const VERSION = '1.0.0';

let server = null;
let serialConnection = null;
let animationEngine = null;
let simulator = null;

/**
 * Initialize all services
 */
async function initialize() {
  console.log(`\n${APP_NAME} v${VERSION}`);
  console.log('='.repeat(50));
  
  console.log('\n[1/5] Initializing database...');
  await database.initialize();
  console.log('      Database initialized');

  const simulationMode = process.env.SIMULATION_MODE === 'true' || database.settings.get('simulation_mode') === 'true';
  const comPort = database.settings.get('com_port') || '/dev/ttyUSB0';
  const baudRate = parseInt(database.settings.get('baud_rate') || '38400', 10);

  console.log('\n[2/5] Initializing serial connection...');
  console.log(`      Port: ${comPort}, Baud: ${baudRate}`);
  console.log(`      Simulation Mode: ${simulationMode}`);
  
  serialConnection = new mdp.SerialConnection({
    path: comPort,
    baudRate: baudRate,
    simulationMode: simulationMode,
    autoOpen: false
  });

  serialConnection.on('log', ({ level, message }) => {
    console.log(`      [Serial ${level.toUpperCase()}] ${message}`);
  });

  serialConnection.on('sent', ({ data, simulated }) => {
    const hex = mdp.packetToHex(data);
    database.commandLog.add({
      source: 'serial',
      commandType: 'send',
      requestData: { hex, simulated },
      success: true
    });
  });

  try {
    await serialConnection.connect();
    console.log('      Serial connection established');
  } catch (err) {
    console.warn(`      Serial connection failed: ${err.message}`);
    console.warn('      Running in simulation mode');
    serialConnection.setSimulationMode(true);
    serialConnection.isOpen = true;
  }

  console.log('\n[3/5] Initializing simulator...');
  simulator = new LightSimulator();
  simulator.initializeFromDatabase(database);
  const simEnabled = serialConnection.simulationMode;
  simulator.setEnabled(simEnabled);
  console.log(`      Simulator initialized (${simulator.getStats().totalLights} lights, enabled: ${simEnabled})`);

  serialConnection.on('sent', ({ data }) => {
    if (simulator.isEnabled()) {
      simulator.processPacket(data);
    }
  });

  console.log('\n[4/5] Initializing API server...');
  const { createServer } = require('./api/server');
  const { server: httpServer, app, io } = await createServer(serialConnection, { simulator });
  server = httpServer;
  
  const port = parseInt(process.env.PORT || database.settings.get('api_port') || '3000', 10);
  console.log(`      PORT env: ${process.env.PORT}, Using port: ${port}`);
  
  await new Promise((resolve, reject) => {
    server.on('error', (err) => {
      console.error(`      Server error: ${err.message}`);
      reject(err);
    });
    server.listen(port, '0.0.0.0', () => {
      console.log(`      API server listening on port ${port}`);
      resolve();
    });
  });

  console.log('\n[5/5] Initializing animation engine...');
  const AnimationEngine = require('./animation/ambient');
  animationEngine = new AnimationEngine(serialConnection, database);
  
  const ambientEnabled = database.settings.get('ambient_enabled') === 'true';
  if (ambientEnabled) {
    animationEngine.startAmbient();
    console.log('      Ambient animation started');
  } else {
    console.log('      Ambient animation disabled');
  }

  console.log('\n' + '='.repeat(50));
  console.log('Middleware initialized successfully!');
  console.log(`API Documentation: http://localhost:${port}/api/docs`);
  console.log(`Admin Dashboard: http://localhost:${port}/`);
  console.log('='.repeat(50) + '\n');

  database.sessionLog.add('system_start', null, { version: VERSION });

  return {
    server,
    serialConnection,
    animationEngine,
    database
  };
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\nShutting down...');

  if (animationEngine) {
    animationEngine.stop();
  }

  if (server) {
    server.close();
  }

  if (serialConnection) {
    await serialConnection.close();
  }

  database.sessionLog.add('system_stop');
  database.close();

  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (require.main === module) {
  initialize().catch(err => {
    console.error('Failed to initialize:', err);
    process.exit(1);
  });
}

module.exports = {
  initialize,
  shutdown
};
