/**
 * Validation Middleware
 * Request validation helpers
 */

const { body, param, query, validationResult } = require('express-validator');

const VALID_STATES = ['SOLD', 'AVAILABLE', 'UNAVAILABLE', 'SELECTED', 'RESERVED', 'OFF'];

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
};

const apartmentIdParam = param('id')
  .isString()
  .notEmpty()
  .withMessage('Apartment ID is required');

const stateBody = body('state')
  .optional()
  .isIn(VALID_STATES)
  .withMessage(`State must be one of: ${VALID_STATES.join(', ')}`);

const intensityBody = body('intensity')
  .optional()
  .isInt({ min: 0, max: 255 })
  .withMessage('Intensity must be between 0 and 255');

const fadeTimeBody = body('fadeTime')
  .optional()
  .isInt({ min: 0, max: 10000 })
  .withMessage('Fade time must be between 0 and 10000 ms');

const rgbBody = [
  body('rgb.r').optional().isInt({ min: 0, max: 255 }),
  body('rgb.g').optional().isInt({ min: 0, max: 255 }),
  body('rgb.b').optional().isInt({ min: 0, max: 255 })
];

const batchApartmentsBody = body('apartments')
  .isArray({ min: 1 })
  .withMessage('Apartments array is required');

const validateApartmentUpdate = [
  apartmentIdParam,
  stateBody,
  intensityBody,
  fadeTimeBody,
  ...rgbBody,
  validateRequest
];

const validateBatchUpdate = [
  batchApartmentsBody,
  validateRequest
];

module.exports = {
  validateRequest,
  validateApartmentUpdate,
  validateBatchUpdate,
  apartmentIdParam,
  stateBody,
  intensityBody,
  fadeTimeBody,
  rgbBody,
  VALID_STATES
};
