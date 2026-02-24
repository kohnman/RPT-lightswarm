/**
 * Serial Communication Layer
 * Handles USB/Serial connection to LightSwarm controller
 */

const EventEmitter = require('events');

class SerialConnection extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      path: config.path || '/dev/ttyUSB0',
      baudRate: config.baudRate || 38400,
      autoOpen: config.autoOpen !== false,
      ...config
    };
    this.port = null;
    this.isOpen = false;
    this.simulationMode = config.simulationMode || false;
    this.commandQueue = [];
    this.processing = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
  }

  /**
   * Initialize the serial connection
   */
  async connect() {
    if (this.simulationMode) {
      this.isOpen = true;
      this.emit('open');
      this.emit('log', { level: 'info', message: 'Serial connection opened in SIMULATION MODE' });
      return;
    }

    try {
      const { SerialPort } = await import('serialport');
      
      this.port = new SerialPort({
        path: this.config.path,
        baudRate: this.config.baudRate,
        autoOpen: false
      });

      this.port.on('open', () => {
        this.isOpen = true;
        this.reconnectAttempts = 0;
        this.emit('open');
        this.emit('log', { level: 'info', message: `Serial port opened: ${this.config.path}` });
        this.processQueue();
      });

      this.port.on('close', () => {
        this.isOpen = false;
        this.emit('close');
        this.emit('log', { level: 'warn', message: 'Serial port closed' });
        this.attemptReconnect();
      });

      this.port.on('error', (err) => {
        this.emit('error', err);
        this.emit('log', { level: 'error', message: `Serial error: ${err.message}` });
      });

      this.port.on('data', (data) => {
        this.emit('data', data);
      });

      await new Promise((resolve, reject) => {
        this.port.open((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

    } catch (err) {
      this.emit('log', { level: 'error', message: `Failed to open serial port: ${err.message}` });
      throw err;
    }
  }

  /**
   * Attempt to reconnect after connection loss
   */
  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('log', { level: 'error', message: 'Max reconnection attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    this.emit('log', { 
      level: 'info', 
      message: `Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...` 
    });

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (err) {
        this.attemptReconnect();
      }
    }, this.reconnectDelay);
  }

  /**
   * Close the serial connection
   */
  async close() {
    if (this.simulationMode) {
      this.isOpen = false;
      this.emit('close');
      return;
    }

    if (this.port && this.isOpen) {
      return new Promise((resolve) => {
        this.port.close(() => {
          this.isOpen = false;
          resolve();
        });
      });
    }
  }

  /**
   * Send data to the serial port
   * @param {Buffer} data - Data to send
   * @returns {Promise<void>}
   */
  async send(data) {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ data, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the command queue
   */
  async processQueue() {
    if (this.processing || this.commandQueue.length === 0) {
      return;
    }

    if (!this.isOpen) {
      return;
    }

    this.processing = true;
    const { data, resolve, reject } = this.commandQueue.shift();

    try {
      if (this.simulationMode) {
        this.emit('log', { 
          level: 'debug', 
          message: `[SIM] Sending: ${this.bufferToHex(data)}` 
        });
        this.emit('sent', { data, simulated: true });
        await this.delay(5);
        resolve();
      } else {
        await new Promise((res, rej) => {
          this.port.write(data, (err) => {
            if (err) {
              rej(err);
              return;
            }
            this.port.drain((drainErr) => {
              if (drainErr) rej(drainErr);
              else res();
            });
          });
        });
        this.emit('sent', { data, simulated: false });
        resolve();
      }
    } catch (err) {
      this.emit('log', { level: 'error', message: `Send error: ${err.message}` });
      reject(err);
    }

    this.processing = false;
    
    if (this.commandQueue.length > 0) {
      await this.delay(10);
      this.processQueue();
    }
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert buffer to hex string for logging
   */
  bufferToHex(buffer) {
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  /**
   * List available serial ports
   * @returns {Promise<Array>} List of available ports
   */
  static async listPorts() {
    try {
      const { SerialPort } = await import('serialport');
      return await SerialPort.list();
    } catch (err) {
      return [];
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isOpen: this.isOpen,
      simulationMode: this.simulationMode,
      port: this.config.path,
      baudRate: this.config.baudRate,
      queueLength: this.commandQueue.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Enable/disable simulation mode
   */
  setSimulationMode(enabled) {
    this.simulationMode = enabled;
    this.emit('log', { 
      level: 'info', 
      message: `Simulation mode ${enabled ? 'enabled' : 'disabled'}` 
    });
  }
}

module.exports = SerialConnection;
