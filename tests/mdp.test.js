/**
 * MDP Protocol Tests
 */

const mdp = require('../src/mdp');

describe('MDP Protocol', () => {
  describe('SLIP Encoding', () => {
    test('encodes simple data with frame delimiters', () => {
      const data = [0x00, 0x01, 0x20];
      const encoded = mdp.slip.encode(data);
      
      expect(encoded[0]).toBe(0xC0);
      expect(encoded[encoded.length - 1]).toBe(0xC0);
    });

    test('escapes END byte in data', () => {
      const data = [0x00, 0xC0, 0x01];
      const encoded = mdp.slip.encode(data);
      
      expect(Array.from(encoded)).toContain(0xDB);
      expect(Array.from(encoded)).toContain(0xDC);
    });

    test('escapes ESC byte in data', () => {
      const data = [0x00, 0xDB, 0x01];
      const encoded = mdp.slip.encode(data);
      
      const arr = Array.from(encoded);
      expect(arr.filter(b => b === 0xDB).length).toBe(1);
      expect(arr).toContain(0xDD);
    });
  });

  describe('Checksum Calculation', () => {
    test('calculates XOR checksum correctly', () => {
      const data = [0x00, 0x05, 0x21];
      const checksum = mdp.calculateChecksum(data);
      expect(checksum).toBe(0x24);
    });

    test('handles larger data correctly', () => {
      const data = [0x24, 0x29, 0x23, 0xDF, 0x04, 0x03];
      const checksum = mdp.calculateChecksum(data);
      expect(checksum).toBe(0xF6);
    });
  });

  describe('Command Building', () => {
    test('builds ON command', () => {
      const cmd = mdp.commands.buildOnCommand(5);
      expect(cmd).toEqual([0x00, 0x05, 0x20]);
    });

    test('builds OFF command', () => {
      const cmd = mdp.commands.buildOffCommand(5);
      expect(cmd).toEqual([0x00, 0x05, 0x21]);
    });

    test('builds LEVEL command', () => {
      const cmd = mdp.commands.buildLevelCommand(100, 200);
      expect(cmd).toEqual([0x00, 0x64, 0x22, 0xC8]);
    });

    test('builds RGB_LEVEL command', () => {
      const cmd = mdp.commands.buildRgbLevelCommand(100, 255, 128, 64);
      expect(cmd).toEqual([0x00, 0x64, 0x2C, 0xFF, 0x80, 0x40]);
    });

    test('builds FADE command', () => {
      const cmd = mdp.commands.buildFadeCommand(100, 255, 10, 5);
      expect(cmd).toEqual([0x00, 0x64, 0x23, 0xFF, 0x0A, 0x05]);
    });
  });

  describe('Address Conversion', () => {
    test('converts address to bytes', () => {
      expect(mdp.commands.addressToBytes(0)).toEqual([0x00, 0x00]);
      expect(mdp.commands.addressToBytes(255)).toEqual([0x00, 0xFF]);
      expect(mdp.commands.addressToBytes(256)).toEqual([0x01, 0x00]);
      expect(mdp.commands.addressToBytes(65535)).toEqual([0xFF, 0xFF]);
    });

    test('converts bytes to address', () => {
      expect(mdp.commands.bytesToAddress([0x00, 0x00])).toBe(0);
      expect(mdp.commands.bytesToAddress([0x00, 0xFF])).toBe(255);
      expect(mdp.commands.bytesToAddress([0x01, 0x00])).toBe(256);
      expect(mdp.commands.bytesToAddress([0xFF, 0xFF])).toBe(65535);
    });
  });

  describe('Complete Packet Building', () => {
    test('builds complete ON packet', () => {
      const packet = mdp.packetOn(5);
      
      expect(packet[0]).toBe(0xC0);
      expect(packet[packet.length - 1]).toBe(0xC0);
      expect(packet.length).toBeGreaterThan(4);
    });

    test('builds complete RGB packet', () => {
      const packet = mdp.packetRgbLevel(100, 255, 0, 0);
      
      expect(packet[0]).toBe(0xC0);
      expect(packet[packet.length - 1]).toBe(0xC0);
    });
  });

  describe('Fade Parameter Calculation', () => {
    test('calculates fade params for short fade', () => {
      const params = mdp.calculateFadeParams(0, 255, 500);
      expect(params.interval).toBeGreaterThan(0);
      expect(params.step).toBeGreaterThan(0);
      expect(params.interval).toBeLessThanOrEqual(255);
      expect(params.step).toBeLessThanOrEqual(127);
    });

    test('calculates fade params for long fade', () => {
      const params = mdp.calculateFadeParams(0, 255, 5000);
      expect(params.interval).toBeGreaterThan(0);
      expect(params.step).toBeGreaterThan(0);
    });

    test('handles zero difference', () => {
      const params = mdp.calculateFadeParams(100, 100, 500);
      expect(params.interval).toBe(1);
      expect(params.step).toBe(1);
    });
  });

  describe('Packet Hex Conversion', () => {
    test('converts packet to hex string', () => {
      const packet = Buffer.from([0xC0, 0x00, 0x05, 0x20, 0x25, 0xC0]);
      const hex = mdp.packetToHex(packet);
      expect(hex).toBe('C0 00 05 20 25 C0');
    });
  });
});
