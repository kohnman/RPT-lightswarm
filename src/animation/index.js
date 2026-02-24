/**
 * Animation Module Index
 */

const AnimationEngine = require('./ambient');
const sequences = require('./sequences');

module.exports = {
  AnimationEngine,
  ...sequences
};
