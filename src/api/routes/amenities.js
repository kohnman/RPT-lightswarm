/**
 * Amenities Routes
 * Control lighting for amenity areas (gym, cinema, lounge, etc.)
 */

const express = require('express');
const router = express.Router();
const { database } = require('../../config');
const mdp = require('../../mdp');

/**
 * Helper to get RGB color for a state
 */
function getStateColor(state) {
  const stateColor = database.stateColors.get(state);
  if (!stateColor) {
    return { r: 255, g: 255, b: 255, intensity: 200 };
  }
  return { r: stateColor.red, g: stateColor.green, b: stateColor.blue, intensity: stateColor.intensity };
}

/**
 * GET /api/v1/amenities
 * List all amenities
 */
router.get('/', (req, res) => {
  const { tower, floor, type } = req.query;
  
  let amenities;
  if (type) {
    amenities = database.amenities.getByType(type);
  } else if (tower && floor) {
    amenities = database.amenities.getByFloor(tower, parseInt(floor, 10));
  } else {
    amenities = database.amenities.getAll();
  }

  res.json({ amenities, count: amenities.length });
});

/**
 * GET /api/v1/amenities/:id
 * Get single amenity details
 */
router.get('/:id', (req, res) => {
  const amenity = database.amenities.get(req.params.id);
  if (!amenity) {
    return res.status(404).json({ error: 'Amenity not found', code: 'NOT_FOUND' });
  }
  res.json(amenity);
});

/**
 * PUT /api/v1/amenities/:id
 * Light single amenity
 */
router.put('/:id', async (req, res, next) => {
  try {
    const amenity = database.amenities.get(req.params.id);
    if (!amenity) {
      return res.status(404).json({ error: 'Amenity not found', code: 'NOT_FOUND' });
    }

    const { state = 'SELECTED', intensity, fadeTime, rgb } = req.body;
    const serial = req.app.locals.serial;
    const io = req.app.locals.io;

    const defaultFadeTime = parseInt(database.settings.get('default_fade_time_ms') || '500', 10);
    const defaultIntensity = parseInt(database.settings.get('default_intensity') || '200', 10);

    let color;
    if (rgb && rgb.r !== undefined) {
      color = rgb;
    } else {
      color = getStateColor(state);
    }

    const actualFadeTime = fadeTime ?? defaultFadeTime;
    const actualIntensity = intensity ?? color.intensity ?? defaultIntensity;

    const scaledR = Math.round((color.r * actualIntensity) / 255);
    const scaledG = Math.round((color.g * actualIntensity) / 255);
    const scaledB = Math.round((color.b * actualIntensity) / 255);

    let packet;
    if (actualFadeTime > 0) {
      packet = mdp.packetRgbFadeToColor(amenity.lightswarm_address, scaledR, scaledG, scaledB, actualFadeTime);
    } else {
      packet = mdp.packetRgbLevel(amenity.lightswarm_address, scaledR, scaledG, scaledB);
    }

    await serial.send(packet);

    io.emit('amenity_updated', {
      id: amenity.id,
      address: amenity.lightswarm_address,
      state,
      color: { r: scaledR, g: scaledG, b: scaledB }
    });

    res.json({
      success: true,
      id: amenity.id,
      name: amenity.name,
      type: amenity.amenity_type,
      address: amenity.lightswarm_address,
      state,
      color: { r: scaledR, g: scaledG, b: scaledB },
      fadeTime: actualFadeTime
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/amenities/floor/:floorId
 * Light all amenities on a floor
 */
router.put('/floor/:floorId', async (req, res, next) => {
  try {
    const floor = parseInt(req.params.floorId, 10);
    const { tower, state = 'SELECTED', intensity, fadeTime } = req.body;
    const serial = req.app.locals.serial;
    const io = req.app.locals.io;

    const amenities = database.amenities.getByFloor(tower || null, floor);
    
    if (amenities.length === 0) {
      return res.status(404).json({ error: 'No amenities found on this floor', code: 'NOT_FOUND' });
    }

    const color = getStateColor(state);
    const defaultFadeTime = parseInt(database.settings.get('default_fade_time_ms') || '500', 10);
    const defaultIntensity = parseInt(database.settings.get('default_intensity') || '200', 10);

    const actualFadeTime = fadeTime ?? defaultFadeTime;
    const actualIntensity = intensity ?? color.intensity ?? defaultIntensity;

    const scaledR = Math.round((color.r * actualIntensity) / 255);
    const scaledG = Math.round((color.g * actualIntensity) / 255);
    const scaledB = Math.round((color.b * actualIntensity) / 255);

    const results = [];
    for (const amenity of amenities) {
      const packet = mdp.packetRgbFadeToColor(amenity.lightswarm_address, scaledR, scaledG, scaledB, actualFadeTime);
      await serial.send(packet);
      results.push({ id: amenity.id, name: amenity.name, type: amenity.amenity_type });
    }

    io.emit('amenities_floor_updated', { floor, state, count: results.length });

    res.json({
      success: true,
      floor,
      state,
      color: { r: scaledR, g: scaledG, b: scaledB },
      fadeTime: actualFadeTime,
      amenities: results,
      count: results.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/amenities/batch
 * Light multiple amenities
 */
router.put('/batch', async (req, res, next) => {
  try {
    const { amenities: amenityIds, state = 'SELECTED', intensity, fadeTime } = req.body;
    const serial = req.app.locals.serial;
    const io = req.app.locals.io;

    if (!Array.isArray(amenityIds) || amenityIds.length === 0) {
      return res.status(400).json({ error: 'Amenities array is required', code: 'VALIDATION_ERROR' });
    }

    const color = getStateColor(state);
    const defaultFadeTime = parseInt(database.settings.get('default_fade_time_ms') || '500', 10);
    const defaultIntensity = parseInt(database.settings.get('default_intensity') || '200', 10);

    const actualFadeTime = fadeTime ?? defaultFadeTime;
    const actualIntensity = intensity ?? color.intensity ?? defaultIntensity;

    const scaledR = Math.round((color.r * actualIntensity) / 255);
    const scaledG = Math.round((color.g * actualIntensity) / 255);
    const scaledB = Math.round((color.b * actualIntensity) / 255);

    const results = [];
    const errors = [];

    for (const amenityId of amenityIds) {
      const amenity = database.amenities.get(amenityId);
      if (!amenity) {
        errors.push({ id: amenityId, error: 'Not found' });
        continue;
      }

      const packet = mdp.packetRgbFadeToColor(amenity.lightswarm_address, scaledR, scaledG, scaledB, actualFadeTime);
      await serial.send(packet);
      results.push({ id: amenity.id, name: amenity.name, type: amenity.amenity_type });
    }

    io.emit('amenities_batch_updated', { results, count: results.length });

    res.json({
      success: errors.length === 0,
      updated: results,
      errors: errors.length > 0 ? errors : undefined,
      count: results.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/amenities/:id/off
 * Turn off single amenity
 */
router.post('/:id/off', async (req, res, next) => {
  try {
    const amenity = database.amenities.get(req.params.id);
    if (!amenity) {
      return res.status(404).json({ error: 'Amenity not found', code: 'NOT_FOUND' });
    }

    const serial = req.app.locals.serial;
    const fadeTimeMs = parseInt(database.settings.get('default_fade_time_ms') || '500', 10);
    const fadeParams = mdp.calculateFadeParams(255, 0, fadeTimeMs);
    
    const packet = mdp.packetFade(amenity.lightswarm_address, 0, fadeParams.interval, fadeParams.step);
    await serial.send(packet);

    res.json({ success: true, id: amenity.id, state: 'OFF' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
