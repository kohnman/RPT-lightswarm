/**
 * SLIP Protocol Implementation
 * Serial Line Internet Protocol as per RFC 1055
 * Used for framing MDP packets for LightSwarm communication
 */

const SLIP_END = 0xC0;
const SLIP_ESC = 0xDB;
const SLIP_ESC_END = 0xDC;
const SLIP_ESC_ESC = 0xDD;

/**
 * Encode a byte array with SLIP framing
 * @param {number[]} data - Array of bytes to encode
 * @returns {Buffer} SLIP-encoded buffer
 */
function encode(data) {
  const encoded = [SLIP_END];

  for (const byte of data) {
    switch (byte) {
      case SLIP_END:
        encoded.push(SLIP_ESC, SLIP_ESC_END);
        break;
      case SLIP_ESC:
        encoded.push(SLIP_ESC, SLIP_ESC_ESC);
        break;
      default:
        encoded.push(byte);
    }
  }

  encoded.push(SLIP_END);
  return Buffer.from(encoded);
}

/**
 * Decode a SLIP-encoded buffer
 * @param {Buffer} buffer - SLIP-encoded buffer
 * @returns {number[]} Decoded byte array
 */
function decode(buffer) {
  const decoded = [];
  let escaping = false;

  for (const byte of buffer) {
    if (escaping) {
      switch (byte) {
        case SLIP_ESC_END:
          decoded.push(SLIP_END);
          break;
        case SLIP_ESC_ESC:
          decoded.push(SLIP_ESC);
          break;
        default:
          decoded.push(byte);
      }
      escaping = false;
    } else {
      switch (byte) {
        case SLIP_END:
          break;
        case SLIP_ESC:
          escaping = true;
          break;
        default:
          decoded.push(byte);
      }
    }
  }

  return decoded;
}

module.exports = {
  SLIP_END,
  SLIP_ESC,
  SLIP_ESC_END,
  SLIP_ESC_ESC,
  encode,
  decode
};
