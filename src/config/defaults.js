/**
 * Default Configuration Values
 */

module.exports = {
  serial: {
    path: '/dev/ttyUSB0',
    baudRate: 38400
  },

  server: {
    port: 3000,
    corsOrigins: ['*']
  },

  lighting: {
    defaultFadeTimeMs: 500,
    defaultIntensity: 200,
    loginFadeDelayMs: 100
  },

  stateColors: {
    SOLD: { r: 255, g: 0, b: 0, intensity: 200 },
    AVAILABLE: { r: 0, g: 255, b: 0, intensity: 200 },
    UNAVAILABLE: { r: 180, g: 80, b: 0, intensity: 200 },
    SELECTED: { r: 255, g: 255, b: 255, intensity: 255 },
    RESERVED: { r: 255, g: 255, b: 0, intensity: 200 },
    OFF: { r: 0, g: 0, b: 0, intensity: 0 }
  },

  ambient: {
    enabled: true,
    defaultSequence: {
      type: 'static',
      steps: [{
        command: 'all_on',
        intensity: 100,
        color: { r: 255, g: 255, b: 255 }
      }]
    }
  },

  logging: {
    retentionDays: 30,
    level: 'info'
  }
};
