/**
 * MDP Command Definitions
 * ModelMation Device Protocol commands for LightSwarm
 * Based on LightSwarm Technical Specification V1.18
 */

const MDP_COMMANDS = {
  NOP: 0x00,
  RESET: 0x01,
  PING_REQ: 0x02,
  PING_RESP: 0x03,
  ON: 0x20,
  OFF: 0x21,
  LEVEL: 0x22,
  FADE: 0x23,
  PADDSET: 0x25,
  PADDERASE: 0x26,
  MEDIA: 0x27,
  EVENT_START: 0x28,
  EVENT_STOP: 0x29,
  FORWARD: 0x2A,
  MECH: 0x2B,
  RGB_LEVEL: 0x2C,
  TOGGLE: 0x2D,
  FLASH: 0x2E,
  RGB_FLASH: 0x2F,
  FADE_MULTI: 0x30,
  RGB_FADE: 0x31,
  SUBCMD: 0x7C,
  CONFIG: 0x7D
};

const BROADCAST_ADDRESS = 0xFFFF;
const MASTER_ADDRESS = 0xFFFE;

/**
 * Convert a 16-bit address to a 2-byte array
 * @param {number} address - 16-bit address (0-65535)
 * @returns {number[]} Two-byte array [high, low]
 */
function addressToBytes(address) {
  if (address < 0 || address > 0xFFFF) {
    throw new Error(`Invalid address: ${address}. Must be 0-65535.`);
  }
  return [(address >> 8) & 0xFF, address & 0xFF];
}

/**
 * Convert a 2-byte array to a 16-bit address
 * @param {number[]} bytes - Two-byte array [high, low]
 * @returns {number} 16-bit address
 */
function bytesToAddress(bytes) {
  return (bytes[0] << 8) | bytes[1];
}

/**
 * Build MDP_ON command - Turn channel fully on
 * @param {number} address - Channel address
 * @returns {number[]} Command bytes
 */
function buildOnCommand(address) {
  return [...addressToBytes(address), MDP_COMMANDS.ON];
}

/**
 * Build MDP_OFF command - Turn channel off
 * @param {number} address - Channel address
 * @returns {number[]} Command bytes
 */
function buildOffCommand(address) {
  return [...addressToBytes(address), MDP_COMMANDS.OFF];
}

/**
 * Build MDP_LEVEL command - Set channel brightness
 * @param {number} address - Channel address
 * @param {number} level - Brightness level (0-255)
 * @returns {number[]} Command bytes
 */
function buildLevelCommand(address, level) {
  const clampedLevel = Math.max(0, Math.min(255, Math.round(level)));
  return [...addressToBytes(address), MDP_COMMANDS.LEVEL, clampedLevel];
}

/**
 * Build MDP_FADE command - Fade to level over time
 * @param {number} address - Channel address
 * @param {number} level - Target brightness level (0-255)
 * @param {number} interval - Interval between steps in 1/100 seconds (1-255)
 * @param {number} step - PWM change per interval (1-127)
 * @returns {number[]} Command bytes
 */
function buildFadeCommand(address, level, interval = 2, step = 5) {
  const clampedLevel = Math.max(0, Math.min(255, Math.round(level)));
  const clampedInterval = Math.max(1, Math.min(255, Math.round(interval)));
  const clampedStep = Math.max(1, Math.min(127, Math.round(step)));
  return [
    ...addressToBytes(address),
    MDP_COMMANDS.FADE,
    clampedLevel,
    clampedInterval,
    clampedStep
  ];
}

/**
 * Build MDP_RGB_LEVEL command - Set RGB color levels
 * @param {number} address - Channel address
 * @param {number} red - Red level (0-255)
 * @param {number} green - Green level (0-255)
 * @param {number} blue - Blue level (0-255)
 * @returns {number[]} Command bytes
 */
function buildRgbLevelCommand(address, red, green, blue) {
  return [
    ...addressToBytes(address),
    MDP_COMMANDS.RGB_LEVEL,
    Math.max(0, Math.min(255, Math.round(red))),
    Math.max(0, Math.min(255, Math.round(green))),
    Math.max(0, Math.min(255, Math.round(blue)))
  ];
}

/**
 * Build MDP_RGB_FADE command - Fade RGB channels to target colors
 * @param {number} address - Channel address
 * @param {Object} red - {level, interval, step} for red channel
 * @param {Object} green - {level, interval, step} for green channel
 * @param {Object} blue - {level, interval, step} for blue channel
 * @returns {number[]} Command bytes
 */
function buildRgbFadeCommand(address, red, green, blue) {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, Math.round(val)));
  return [
    ...addressToBytes(address),
    MDP_COMMANDS.RGB_FADE,
    clamp(red.level, 0, 255),
    clamp(red.interval, 1, 255),
    clamp(red.step, 1, 127),
    clamp(green.level, 0, 255),
    clamp(green.interval, 1, 255),
    clamp(green.step, 1, 127),
    clamp(blue.level, 0, 255),
    clamp(blue.interval, 1, 255),
    clamp(blue.step, 1, 127)
  ];
}

/**
 * Build MDP_FLASH command - Flash between two levels
 * @param {number} address - Channel address
 * @param {number} levelA - First PWM level (0-255)
 * @param {number} levelB - Second PWM level (0-255)
 * @param {number} flashSteps - Number of flash steps (2-65535, use 65535 for indefinite)
 * @param {number} intervalA - Time at level A in 1/100 seconds
 * @param {number} intervalB - Time at level B in 1/100 seconds
 * @returns {number[]} Command bytes
 */
function buildFlashCommand(address, levelA, levelB, flashSteps, intervalA, intervalB) {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, Math.round(val)));
  const steps = clamp(flashSteps, 2, 65535);
  const intA = clamp(intervalA, 1, 65535);
  const intB = clamp(intervalB, 1, 65535);

  return [
    ...addressToBytes(address),
    MDP_COMMANDS.FLASH,
    (steps >> 8) & 0xFF,
    steps & 0xFF,
    (intA >> 8) & 0xFF,
    intA & 0xFF,
    (intB >> 8) & 0xFF,
    intB & 0xFF,
    clamp(levelA, 0, 255),
    clamp(levelB, 0, 255)
  ];
}

/**
 * Build MDP_PADDSET command - Set pseudo address
 * @param {number} physicalAddress - Physical channel address
 * @param {number} pseudoAddress - Pseudo address to assign
 * @returns {number[]} Command bytes
 */
function buildPseudoAddressSetCommand(physicalAddress, pseudoAddress) {
  return [
    ...addressToBytes(physicalAddress),
    MDP_COMMANDS.PADDSET,
    ...addressToBytes(pseudoAddress)
  ];
}

/**
 * Build MDP_PADDERASE command - Erase pseudo address table
 * @param {number} address - Channel address
 * @returns {number[]} Command bytes
 */
function buildPseudoAddressEraseCommand(address) {
  return [...addressToBytes(address), MDP_COMMANDS.PADDERASE];
}

module.exports = {
  MDP_COMMANDS,
  BROADCAST_ADDRESS,
  MASTER_ADDRESS,
  addressToBytes,
  bytesToAddress,
  buildOnCommand,
  buildOffCommand,
  buildLevelCommand,
  buildFadeCommand,
  buildRgbLevelCommand,
  buildRgbFadeCommand,
  buildFlashCommand,
  buildPseudoAddressSetCommand,
  buildPseudoAddressEraseCommand
};
