/**
 * Predefined Animation Sequences
 * Ready-to-use animation templates
 */

const sequences = {
  staticWhite: {
    id: 'static_white',
    name: 'Static White',
    description: 'All lights on at steady white',
    type: 'static',
    steps: [{
      command: 'all_on',
      intensity: 150,
      color: { r: 255, g: 255, b: 255 }
    }]
  },

  staticWarmWhite: {
    id: 'static_warm_white',
    name: 'Static Warm White',
    description: 'All lights on at warm white',
    type: 'static',
    steps: [{
      command: 'all_on',
      intensity: 150,
      color: { r: 255, g: 220, b: 180 }
    }]
  },

  waveUp: {
    id: 'wave_up',
    name: 'Wave Up',
    description: 'Lights wave from bottom to top',
    type: 'wave',
    direction: 'up',
    color: { r: 255, g: 255, b: 255 },
    intensity: 180,
    floorDelay: 150,
    fadeTime: 300,
    holdTime: 1000,
    pauseBetween: 500,
    loop: true
  },

  waveDown: {
    id: 'wave_down',
    name: 'Wave Down',
    description: 'Lights wave from top to bottom',
    type: 'wave',
    direction: 'down',
    color: { r: 255, g: 255, b: 255 },
    intensity: 180,
    floorDelay: 150,
    fadeTime: 300,
    holdTime: 1000,
    pauseBetween: 500,
    loop: true
  },

  breatheSlow: {
    id: 'breathe_slow',
    name: 'Slow Breathe',
    description: 'Gentle breathing effect',
    type: 'breathe',
    color: { r: 255, g: 255, b: 255 },
    minIntensity: 30,
    maxIntensity: 180,
    breatheDuration: 4000
  },

  breatheFast: {
    id: 'breathe_fast',
    name: 'Fast Breathe',
    description: 'Faster breathing effect',
    type: 'breathe',
    color: { r: 255, g: 255, b: 255 },
    minIntensity: 50,
    maxIntensity: 200,
    breatheDuration: 2000
  },

  colorCycle: {
    id: 'color_cycle',
    name: 'Color Cycle',
    description: 'Cycle through colors',
    type: 'loop',
    stepDuration: 2000,
    steps: [
      { command: 'all_on', intensity: 180, color: { r: 255, g: 0, b: 0 } },
      { command: 'all_on', intensity: 180, color: { r: 0, g: 255, b: 0 } },
      { command: 'all_on', intensity: 180, color: { r: 0, g: 0, b: 255 } },
      { command: 'all_on', intensity: 180, color: { r: 255, g: 255, b: 0 } },
      { command: 'all_on', intensity: 180, color: { r: 255, g: 0, b: 255 } },
      { command: 'all_on', intensity: 180, color: { r: 0, g: 255, b: 255 } }
    ]
  },

  chase: {
    id: 'chase',
    name: 'Chase',
    description: 'Lights chase around',
    type: 'chase',
    color: { r: 255, g: 255, b: 255 },
    intensity: 200,
    chaseDelay: 80,
    tailLength: 5
  },

  rainbowWave: {
    id: 'rainbow_wave',
    name: 'Rainbow Wave',
    description: 'Rainbow wave effect',
    type: 'loop',
    stepDuration: 3000,
    steps: [
      {
        command: 'all_on',
        intensity: 180,
        color: { r: 255, g: 100, b: 100 }
      },
      {
        command: 'all_on',
        intensity: 180,
        color: { r: 255, g: 200, b: 100 }
      },
      {
        command: 'all_on',
        intensity: 180,
        color: { r: 255, g: 255, b: 150 }
      },
      {
        command: 'all_on',
        intensity: 180,
        color: { r: 150, g: 255, b: 150 }
      },
      {
        command: 'all_on',
        intensity: 180,
        color: { r: 150, g: 200, b: 255 }
      },
      {
        command: 'all_on',
        intensity: 180,
        color: { r: 200, g: 150, b: 255 }
      }
    ]
  },

  alertFlash: {
    id: 'alert_flash',
    name: 'Alert Flash',
    description: 'Attention-getting flash',
    type: 'loop',
    stepDuration: 500,
    steps: [
      { command: 'all_on', intensity: 255, color: { r: 255, g: 255, b: 255 } },
      { command: 'all_off' }
    ]
  }
};

/**
 * Get all predefined sequences
 */
function getAllSequences() {
  return Object.values(sequences);
}

/**
 * Get a specific sequence by ID
 */
function getSequence(id) {
  return sequences[id] || Object.values(sequences).find(s => s.id === id);
}

/**
 * Create a custom floor-by-floor sequence
 */
function createFloorSequence(floors, options = {}) {
  const {
    color = { r: 255, g: 255, b: 255 },
    intensity = 180,
    stepDuration = 500,
    loop = true
  } = options;

  return {
    id: `floor_sequence_${Date.now()}`,
    name: 'Custom Floor Sequence',
    description: 'Floor-by-floor animation',
    type: 'loop',
    stepDuration,
    loop,
    steps: floors.map(floor => ({
      command: 'floor',
      floor,
      intensity,
      color
    }))
  };
}

/**
 * Create a state display sequence (show all apartments in their current state)
 */
function createStateDisplaySequence(stateColors) {
  return {
    id: 'state_display',
    name: 'State Display',
    description: 'Show apartments in their current state colors',
    type: 'static',
    useCurrentState: true,
    stateColors
  };
}

module.exports = {
  sequences,
  getAllSequences,
  getSequence,
  createFloorSequence,
  createStateDisplaySequence
};
