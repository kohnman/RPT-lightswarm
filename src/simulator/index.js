/**
 * LightSwarm Simulator
 * Virtual light state tracking for testing without hardware
 */

const EventEmitter = require('events');

class LightSimulator extends EventEmitter {
  constructor() {
    super();
    this.lights = new Map();
    this.enabled = false;
  }

  /**
   * Enable/disable simulation
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.emit('status_changed', { enabled });
  }

  /**
   * Check if simulator is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Initialize lights from database
   */
  initializeFromDatabase(database) {
    const apartments = database.apartments.getAll();
    const amenities = database.amenities.getAll();

    apartments.forEach(apt => {
      this.lights.set(apt.lightswarm_address, {
        id: apt.id,
        type: 'apartment',
        name: apt.name,
        address: apt.lightswarm_address,
        floor: apt.floor,
        tower: apt.tower_id,
        state: {
          on: false,
          level: 0,
          r: 0,
          g: 0,
          b: 0
        },
        lastUpdated: null
      });
    });

    amenities.forEach(amenity => {
      this.lights.set(amenity.lightswarm_address, {
        id: amenity.id,
        type: 'amenity',
        name: amenity.name,
        address: amenity.lightswarm_address,
        floor: amenity.floor,
        amenityType: amenity.amenity_type,
        state: {
          on: false,
          level: 0,
          r: 0,
          g: 0,
          b: 0
        },
        lastUpdated: null
      });
    });

    this.emit('initialized', { count: this.lights.size });
  }

  /**
   * Process a command packet and update virtual state
   */
  processPacket(packet) {
    if (!this.enabled) return null;

    const bytes = Array.from(packet);
    
    if (bytes[0] === 0xC0) bytes.shift();
    if (bytes[bytes.length - 1] === 0xC0) bytes.pop();
    if (bytes.length > 0) bytes.pop();

    if (bytes.length < 3) return null;

    const address = (bytes[0] << 8) | bytes[1];
    const command = bytes[2];
    const data = bytes.slice(3);

    const result = this.executeCommand(address, command, data);
    
    if (result) {
      this.emit('light_updated', result);
    }

    return result;
  }

  /**
   * Execute a command on virtual lights
   */
  executeCommand(address, command, data) {
    if (address === 0xFFFF) {
      return this.executeBroadcast(command, data);
    }

    const light = this.lights.get(address);
    if (!light) {
      return { address, error: 'Address not found', simulated: true };
    }

    const now = new Date().toISOString();
    let change = {};

    switch (command) {
      case 0x20:
        light.state.on = true;
        light.state.level = 255;
        light.state.r = 255;
        light.state.g = 255;
        light.state.b = 255;
        change = { command: 'ON' };
        break;

      case 0x21:
        light.state.on = false;
        light.state.level = 0;
        light.state.r = 0;
        light.state.g = 0;
        light.state.b = 0;
        change = { command: 'OFF' };
        break;

      case 0x22:
        const level = data[0] || 0;
        light.state.on = level > 0;
        light.state.level = level;
        light.state.r = level;
        light.state.g = level;
        light.state.b = level;
        change = { command: 'LEVEL', level };
        break;

      case 0x23:
        const fadeLevel = data[0] || 0;
        light.state.on = fadeLevel > 0;
        light.state.level = fadeLevel;
        light.state.r = fadeLevel;
        light.state.g = fadeLevel;
        light.state.b = fadeLevel;
        change = { command: 'FADE', level: fadeLevel, interval: data[1], step: data[2] };
        break;

      case 0x2C:
        const r = data[0] || 0;
        const g = data[1] || 0;
        const b = data[2] || 0;
        light.state.on = r > 0 || g > 0 || b > 0;
        light.state.level = Math.max(r, g, b);
        light.state.r = r;
        light.state.g = g;
        light.state.b = b;
        change = { command: 'RGB_LEVEL', r, g, b };
        break;

      case 0x31:
        const rFade = data[0] || 0;
        const gFade = data[3] || 0;
        const bFade = data[6] || 0;
        light.state.on = rFade > 0 || gFade > 0 || bFade > 0;
        light.state.level = Math.max(rFade, gFade, bFade);
        light.state.r = rFade;
        light.state.g = gFade;
        light.state.b = bFade;
        change = { command: 'RGB_FADE', r: rFade, g: gFade, b: bFade };
        break;

      default:
        change = { command: `UNKNOWN_${command.toString(16)}` };
    }

    light.lastUpdated = now;

    return {
      address,
      light: { ...light },
      change,
      simulated: true,
      timestamp: now
    };
  }

  /**
   * Execute broadcast command
   */
  executeBroadcast(command, data) {
    const now = new Date().toISOString();
    const results = [];

    for (const [address, light] of this.lights) {
      const result = this.executeCommand(address, command, data);
      if (result && !result.error) {
        results.push(result);
      }
    }

    return {
      broadcast: true,
      command,
      affectedLights: results.length,
      simulated: true,
      timestamp: now
    };
  }

  /**
   * Get current state of all lights
   */
  getAllStates() {
    const states = [];
    for (const [address, light] of this.lights) {
      states.push({
        address,
        ...light
      });
    }
    return states;
  }

  /**
   * Get state of a specific light
   */
  getState(address) {
    return this.lights.get(address) || null;
  }

  /**
   * Get lights by floor
   */
  getLightsByFloor(floor) {
    const floorLights = [];
    for (const [address, light] of this.lights) {
      if (light.floor === floor) {
        floorLights.push({ address, ...light });
      }
    }
    return floorLights;
  }

  /**
   * Get summary statistics
   */
  getStats() {
    let totalLights = 0;
    let lightsOn = 0;
    let apartments = 0;
    let amenities = 0;

    for (const [address, light] of this.lights) {
      totalLights++;
      if (light.state.on) lightsOn++;
      if (light.type === 'apartment') apartments++;
      if (light.type === 'amenity') amenities++;
    }

    return {
      totalLights,
      lightsOn,
      lightsOff: totalLights - lightsOn,
      apartments,
      amenities,
      enabled: this.enabled
    };
  }

  /**
   * Reset all lights to off
   */
  resetAll() {
    for (const [address, light] of this.lights) {
      light.state = {
        on: false,
        level: 0,
        r: 0,
        g: 0,
        b: 0
      };
      light.lastUpdated = new Date().toISOString();
    }
    this.emit('reset', { count: this.lights.size });
  }

  /**
   * Export current state as JSON
   */
  exportState() {
    return {
      enabled: this.enabled,
      lights: this.getAllStates(),
      exportedAt: new Date().toISOString()
    };
  }
}

module.exports = LightSimulator;
