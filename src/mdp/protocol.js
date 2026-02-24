/**
 * MDP Protocol Engine
 * Combines command building, checksum calculation, and SLIP encoding
 * for complete LightSwarm packet generation
 */

const slip = require('./slip');
const commands = require('./commands');

/**
 * Calculate XOR checksum of byte array
 * @param {number[]} data - Array of bytes
 * @returns {number} 8-bit checksum
 */
function calculateChecksum(data) {
  let checksum = 0;
  for (const byte of data) {
    checksum ^= byte;
  }
  return checksum & 0xFF;
}

/**
 * Build a complete MDP packet with checksum and SLIP framing
 * @param {number[]} commandBytes - Raw command bytes (address + command + data)
 * @returns {Buffer} Complete SLIP-encoded packet ready for transmission
 */
function buildPacket(commandBytes) {
  const checksum = calculateChecksum(commandBytes);
  const withChecksum = [...commandBytes, checksum];
  return slip.encode(withChecksum);
}

/**
 * Create a packet to turn a channel on
 * @param {number} address - Channel address
 * @returns {Buffer} Complete packet
 */
function packetOn(address) {
  return buildPacket(commands.buildOnCommand(address));
}

/**
 * Create a packet to turn a channel off
 * @param {number} address - Channel address
 * @returns {Buffer} Complete packet
 */
function packetOff(address) {
  return buildPacket(commands.buildOffCommand(address));
}

/**
 * Create a packet to set channel brightness level
 * @param {number} address - Channel address
 * @param {number} level - Brightness (0-255)
 * @returns {Buffer} Complete packet
 */
function packetLevel(address, level) {
  return buildPacket(commands.buildLevelCommand(address, level));
}

/**
 * Create a packet to fade a channel to a level
 * @param {number} address - Channel address
 * @param {number} level - Target brightness (0-255)
 * @param {number} interval - Fade interval in 1/100s (default 2 = 20ms)
 * @param {number} step - PWM step per interval (default 5)
 * @returns {Buffer} Complete packet
 */
function packetFade(address, level, interval = 2, step = 5) {
  return buildPacket(commands.buildFadeCommand(address, level, interval, step));
}

/**
 * Create a packet to set RGB color
 * @param {number} address - Channel address
 * @param {number} red - Red level (0-255)
 * @param {number} green - Green level (0-255)
 * @param {number} blue - Blue level (0-255)
 * @returns {Buffer} Complete packet
 */
function packetRgbLevel(address, red, green, blue) {
  return buildPacket(commands.buildRgbLevelCommand(address, red, green, blue));
}

/**
 * Create a packet to fade RGB channels
 * @param {number} address - Channel address
 * @param {Object} config - {red: {level, interval, step}, green: {...}, blue: {...}}
 * @returns {Buffer} Complete packet
 */
function packetRgbFade(address, config) {
  const defaults = { level: 0, interval: 2, step: 5 };
  return buildPacket(commands.buildRgbFadeCommand(
    address,
    { ...defaults, ...config.red },
    { ...defaults, ...config.green },
    { ...defaults, ...config.blue }
  ));
}

/**
 * Create a packet to flash a channel
 * @param {number} address - Channel address
 * @param {number} levelA - First level
 * @param {number} levelB - Second level
 * @param {number} steps - Number of flash steps (65535 for infinite)
 * @param {number} intervalA - Time at level A (1/100s)
 * @param {number} intervalB - Time at level B (1/100s)
 * @returns {Buffer} Complete packet
 */
function packetFlash(address, levelA, levelB, steps, intervalA, intervalB) {
  return buildPacket(commands.buildFlashCommand(address, levelA, levelB, steps, intervalA, intervalB));
}

/**
 * Calculate fade parameters from desired fade time
 * @param {number} currentLevel - Current brightness level (0-255)
 * @param {number} targetLevel - Target brightness level (0-255)
 * @param {number} fadeTimeMs - Desired fade time in milliseconds
 * @returns {Object} {interval, step} parameters for fade command
 */
function calculateFadeParams(currentLevel, targetLevel, fadeTimeMs) {
  const levelDiff = Math.abs(targetLevel - currentLevel);
  if (levelDiff === 0) {
    return { interval: 1, step: 1 };
  }

  const minInterval = 1;
  const maxInterval = 255;
  const maxStep = 127;
  
  const fadeTime100ths = fadeTimeMs / 10;
  
  let step = 1;
  let interval = Math.round(fadeTime100ths / levelDiff);
  
  if (interval > maxInterval) {
    interval = maxInterval;
    step = 1;
  } else if (interval < minInterval) {
    interval = minInterval;
    step = Math.min(maxStep, Math.ceil(levelDiff / fadeTime100ths));
  }

  return {
    interval: Math.max(minInterval, Math.min(maxInterval, interval)),
    step: Math.max(1, Math.min(maxStep, step))
  };
}

/**
 * Create a packet to fade to RGB color over time
 * @param {number} address - Channel address
 * @param {number} red - Target red (0-255)
 * @param {number} green - Target green (0-255)
 * @param {number} blue - Target blue (0-255)
 * @param {number} fadeTimeMs - Fade time in milliseconds
 * @param {Object} currentColor - Current {r, g, b} levels (optional, assumes 0 if not provided)
 * @returns {Buffer} Complete packet
 */
function packetRgbFadeToColor(address, red, green, blue, fadeTimeMs, currentColor = { r: 0, g: 0, b: 0 }) {
  const redParams = calculateFadeParams(currentColor.r, red, fadeTimeMs);
  const greenParams = calculateFadeParams(currentColor.g, green, fadeTimeMs);
  const blueParams = calculateFadeParams(currentColor.b, blue, fadeTimeMs);

  return packetRgbFade(address, {
    red: { level: red, ...redParams },
    green: { level: green, ...greenParams },
    blue: { level: blue, ...blueParams }
  });
}

/**
 * Broadcast command to all channels
 * @param {string} commandType - 'on', 'off', or 'level'
 * @param {number} level - Level for 'level' command
 * @returns {Buffer} Complete packet
 */
function packetBroadcast(commandType, level = 255) {
  const address = commands.BROADCAST_ADDRESS;
  switch (commandType) {
    case 'on':
      return packetOn(address);
    case 'off':
      return packetOff(address);
    case 'level':
      return packetLevel(address, level);
    default:
      throw new Error(`Unknown broadcast command type: ${commandType}`);
  }
}

/**
 * Parse a received packet (decode SLIP and verify checksum)
 * @param {Buffer} packet - SLIP-encoded packet
 * @returns {Object|null} {address, command, data} or null if invalid
 */
function parsePacket(packet) {
  const decoded = slip.decode(packet);
  if (decoded.length < 4) return null;

  const receivedChecksum = decoded.pop();
  const calculatedChecksum = calculateChecksum(decoded);

  if (receivedChecksum !== calculatedChecksum) {
    return null;
  }

  const address = commands.bytesToAddress([decoded[0], decoded[1]]);
  const command = decoded[2];
  const data = decoded.slice(3);

  return { address, command, data };
}

/**
 * Convert packet to hex string for logging/debugging
 * @param {Buffer} packet - Packet buffer
 * @returns {string} Hex string representation
 */
function packetToHex(packet) {
  return Array.from(packet)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

module.exports = {
  calculateChecksum,
  buildPacket,
  packetOn,
  packetOff,
  packetLevel,
  packetFade,
  packetRgbLevel,
  packetRgbFade,
  packetRgbFadeToColor,
  packetFlash,
  packetBroadcast,
  parsePacket,
  packetToHex,
  calculateFadeParams,
  BROADCAST_ADDRESS: commands.BROADCAST_ADDRESS,
  MDP_COMMANDS: commands.MDP_COMMANDS
};
