/**
 * Animation Engine
 * Handles ambient state animations and programmable sequences
 */

const EventEmitter = require('events');
const mdp = require('../mdp');

class AnimationEngine extends EventEmitter {
  constructor(serialConnection, database) {
    super();
    this.serial = serialConnection;
    this.database = database;
    this.running = false;
    this.currentSequence = null;
    this.sequenceTimer = null;
    this.stepIndex = 0;
  }

  /**
   * Check if animation is currently running
   */
  isRunning() {
    return this.running;
  }

  /**
   * Start ambient animation
   */
  async startAmbient() {
    if (this.running) {
      return;
    }

    const sequenceId = this.database.settings.get('ambient_sequence_id') || 'default_ambient';
    const sequence = this.database.animationSequences.get(sequenceId);

    if (!sequence) {
      console.warn('Ambient sequence not found, using default');
      await this.runDefaultAmbient();
      return;
    }

    try {
      const sequenceData = JSON.parse(sequence.sequence_data);
      await this.runSequence(sequenceData);
    } catch (err) {
      console.error('Error parsing ambient sequence:', err);
      await this.runDefaultAmbient();
    }
  }

  /**
   * Stop ambient animation
   */
  async stopAmbient() {
    this.running = false;
    
    if (this.sequenceTimer) {
      clearTimeout(this.sequenceTimer);
      this.sequenceTimer = null;
    }

    this.currentSequence = null;
    this.stepIndex = 0;

    this.emit('stopped');
  }

  /**
   * Stop all animations
   */
  stop() {
    this.stopAmbient();
  }

  /**
   * Run the default ambient state (all on at reduced brightness)
   */
  async runDefaultAmbient() {
    this.running = true;
    this.emit('started', { type: 'default' });

    const defaultIntensity = parseInt(this.database.settings.get('default_intensity') || '100', 10);
    const packet = mdp.packetBroadcast('level', defaultIntensity);
    await this.serial.send(packet);

    this.emit('step', { type: 'static', intensity: defaultIntensity });
  }

  /**
   * Run a programmed sequence
   */
  async runSequence(sequenceData) {
    this.running = true;
    this.currentSequence = sequenceData;
    this.stepIndex = 0;

    this.emit('started', { type: sequenceData.type });

    switch (sequenceData.type) {
      case 'static':
        await this.runStaticSequence(sequenceData);
        break;
      case 'loop':
        await this.runLoopSequence(sequenceData);
        break;
      case 'wave':
        await this.runWaveSequence(sequenceData);
        break;
      case 'chase':
        await this.runChaseSequence(sequenceData);
        break;
      case 'breathe':
        await this.runBreatheSequence(sequenceData);
        break;
      default:
        console.warn('Unknown sequence type:', sequenceData.type);
        await this.runDefaultAmbient();
    }
  }

  /**
   * Static sequence - set lights and hold
   */
  async runStaticSequence(sequenceData) {
    if (sequenceData.steps && sequenceData.steps.length > 0) {
      const step = sequenceData.steps[0];
      await this.executeStep(step);
    }
  }

  /**
   * Loop sequence - cycle through steps
   */
  async runLoopSequence(sequenceData) {
    const runStep = async () => {
      if (!this.running) return;

      const step = sequenceData.steps[this.stepIndex];
      await this.executeStep(step);

      this.stepIndex = (this.stepIndex + 1) % sequenceData.steps.length;
      
      const delay = step.duration || sequenceData.stepDuration || 1000;
      this.sequenceTimer = setTimeout(runStep, delay);
    };

    await runStep();
  }

  /**
   * Wave sequence - light floors in sequence
   */
  async runWaveSequence(sequenceData) {
    const { direction = 'up', color = { r: 255, g: 255, b: 255 }, intensity = 150, floorDelay = 200, fadeTime = 300 } = sequenceData;
    
    const { min_floor, max_floor } = this.database.apartments.getFloorRange();
    
    const runWave = async () => {
      if (!this.running) return;

      const floors = [];
      for (let f = min_floor; f <= max_floor; f++) {
        floors.push(f);
      }
      
      if (direction === 'down') {
        floors.reverse();
      }

      for (const floor of floors) {
        if (!this.running) return;

        const apartments = this.database.apartments.getByFloor(null, floor);
        
        for (const apt of apartments) {
          const scaledR = Math.round((color.r * intensity) / 255);
          const scaledG = Math.round((color.g * intensity) / 255);
          const scaledB = Math.round((color.b * intensity) / 255);
          
          const packet = mdp.packetRgbFadeToColor(apt.lightswarm_address, scaledR, scaledG, scaledB, fadeTime);
          await this.serial.send(packet);
        }

        await this.delay(floorDelay);
      }

      await this.delay(sequenceData.holdTime || 1000);

      for (const floor of floors.reverse()) {
        if (!this.running) return;

        const apartments = this.database.apartments.getByFloor(null, floor);
        
        for (const apt of apartments) {
          const packet = mdp.packetRgbFadeToColor(apt.lightswarm_address, 0, 0, 0, fadeTime);
          await this.serial.send(packet);
        }

        await this.delay(floorDelay);
      }

      await this.delay(sequenceData.pauseBetween || 500);

      if (this.running && sequenceData.loop !== false) {
        runWave();
      }
    };

    await runWave();
  }

  /**
   * Chase sequence - lights follow each other
   */
  async runChaseSequence(sequenceData) {
    const { color = { r: 255, g: 255, b: 255 }, intensity = 200, chaseDelay = 50, tailLength = 3 } = sequenceData;
    
    const apartments = this.database.apartments.getAll();
    let position = 0;

    const runChase = async () => {
      if (!this.running) return;

      for (let i = 0; i < apartments.length; i++) {
        const apt = apartments[i];
        const distance = (i - position + apartments.length) % apartments.length;
        
        let brightness = 0;
        if (distance < tailLength) {
          brightness = intensity * (1 - distance / tailLength);
        }

        const scaledR = Math.round((color.r * brightness) / 255);
        const scaledG = Math.round((color.g * brightness) / 255);
        const scaledB = Math.round((color.b * brightness) / 255);

        const packet = mdp.packetRgbLevel(apt.lightswarm_address, scaledR, scaledG, scaledB);
        await this.serial.send(packet);
      }

      position = (position + 1) % apartments.length;
      
      if (this.running) {
        this.sequenceTimer = setTimeout(runChase, chaseDelay);
      }
    };

    await runChase();
  }

  /**
   * Breathe sequence - fade all lights up and down
   */
  async runBreatheSequence(sequenceData) {
    const { color = { r: 255, g: 255, b: 255 }, minIntensity = 50, maxIntensity = 200, breatheDuration = 3000 } = sequenceData;
    
    let increasing = true;
    let currentIntensity = minIntensity;

    const stepInterval = 50;
    const steps = breatheDuration / stepInterval / 2;
    const intensityStep = (maxIntensity - minIntensity) / steps;

    const runBreathe = async () => {
      if (!this.running) return;

      const scaledR = Math.round((color.r * currentIntensity) / 255);
      const scaledG = Math.round((color.g * currentIntensity) / 255);
      const scaledB = Math.round((color.b * currentIntensity) / 255);

      const apartments = this.database.apartments.getAll();
      for (const apt of apartments) {
        const packet = mdp.packetRgbLevel(apt.lightswarm_address, scaledR, scaledG, scaledB);
        await this.serial.send(packet);
      }

      if (increasing) {
        currentIntensity += intensityStep;
        if (currentIntensity >= maxIntensity) {
          currentIntensity = maxIntensity;
          increasing = false;
        }
      } else {
        currentIntensity -= intensityStep;
        if (currentIntensity <= minIntensity) {
          currentIntensity = minIntensity;
          increasing = true;
        }
      }

      if (this.running) {
        this.sequenceTimer = setTimeout(runBreathe, stepInterval);
      }
    };

    await runBreathe();
  }

  /**
   * Execute a single step
   */
  async executeStep(step) {
    this.emit('step', step);

    switch (step.command) {
      case 'all_on':
        const onIntensity = step.intensity || 200;
        if (step.color) {
          const apartments = this.database.apartments.getAll();
          for (const apt of apartments) {
            const scaledR = Math.round((step.color.r * onIntensity) / 255);
            const scaledG = Math.round((step.color.g * onIntensity) / 255);
            const scaledB = Math.round((step.color.b * onIntensity) / 255);
            const packet = mdp.packetRgbLevel(apt.lightswarm_address, scaledR, scaledG, scaledB);
            await this.serial.send(packet);
          }
        } else {
          const packet = mdp.packetBroadcast('level', onIntensity);
          await this.serial.send(packet);
        }
        break;

      case 'all_off':
        const packet = mdp.packetBroadcast('off');
        await this.serial.send(packet);
        break;

      case 'floor':
        const apartments = this.database.apartments.getByFloor(step.tower, step.floor);
        for (const apt of apartments) {
          const intensity = step.intensity || 200;
          if (step.color) {
            const scaledR = Math.round((step.color.r * intensity) / 255);
            const scaledG = Math.round((step.color.g * intensity) / 255);
            const scaledB = Math.round((step.color.b * intensity) / 255);
            const pkt = mdp.packetRgbLevel(apt.lightswarm_address, scaledR, scaledG, scaledB);
            await this.serial.send(pkt);
          } else {
            const pkt = mdp.packetLevel(apt.lightswarm_address, intensity);
            await this.serial.send(pkt);
          }
        }
        break;

      case 'apartment':
        const apt = this.database.apartments.get(step.apartmentId);
        if (apt) {
          const intensity = step.intensity || 200;
          if (step.color) {
            const scaledR = Math.round((step.color.r * intensity) / 255);
            const scaledG = Math.round((step.color.g * intensity) / 255);
            const scaledB = Math.round((step.color.b * intensity) / 255);
            const pkt = mdp.packetRgbLevel(apt.lightswarm_address, scaledR, scaledG, scaledB);
            await this.serial.send(pkt);
          } else {
            const pkt = mdp.packetLevel(apt.lightswarm_address, intensity);
            await this.serial.send(pkt);
          }
        }
        break;

      case 'address':
        if (step.color) {
          const intensity = step.intensity || 200;
          const scaledR = Math.round((step.color.r * intensity) / 255);
          const scaledG = Math.round((step.color.g * intensity) / 255);
          const scaledB = Math.round((step.color.b * intensity) / 255);
          const pkt = mdp.packetRgbLevel(step.address, scaledR, scaledG, scaledB);
          await this.serial.send(pkt);
        } else {
          const pkt = mdp.packetLevel(step.address, step.intensity || 200);
          await this.serial.send(pkt);
        }
        break;

      default:
        console.warn('Unknown step command:', step.command);
    }
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute login fade-down sequence (top floor to bottom)
   */
  async executeLoginFadeDown() {
    const fadeDelayMs = parseInt(this.database.settings.get('login_fade_delay_ms') || '100', 10);
    const fadeTimeMs = parseInt(this.database.settings.get('default_fade_time_ms') || '500', 10);

    const { max_floor, min_floor } = this.database.apartments.getFloorRange();

    for (let floor = max_floor; floor >= min_floor; floor--) {
      const apartments = this.database.apartments.getByFloor(null, floor);

      for (const apt of apartments) {
        const fadeParams = mdp.calculateFadeParams(255, 0, fadeTimeMs);
        const packet = mdp.packetFade(apt.lightswarm_address, 0, fadeParams.interval, fadeParams.step);
        await this.serial.send(packet);
      }

      if (floor > min_floor) {
        await this.delay(fadeDelayMs);
      }
    }
  }
}

module.exports = AnimationEngine;
