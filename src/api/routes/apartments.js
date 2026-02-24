/**
 * Apartments Routes
 * Control lighting for individual and multiple apartments
 */

const express = require('express');
const router = express.Router();
const { database } = require('../../config');
const mdp = require('../../mdp');
const { validateApartmentUpdate, validateBatchUpdate, VALID_STATES } = require('../middleware/validation');

/**
 * Helper to get RGB color for a state
 */
function getStateColor(state, customRgb = null) {
  if (customRgb && customRgb.r !== undefined) {
    return customRgb;
  }
  const stateColor = database.stateColors.get(state);
  if (!stateColor) {
    return { r: 255, g: 255, b: 255 };
  }
  return { r: stateColor.red, g: stateColor.green, b: stateColor.blue, intensity: stateColor.intensity };
}

/**
 * Helper to get all light addresses for an apartment
 * Returns addresses from apartment_lights table, or falls back to lightswarm_address
 */
function getApartmentAddresses(apartmentId, primaryAddress) {
  const lights = database.apartmentLights.getByApartment(apartmentId);
  if (lights && lights.length > 0) {
    return lights.map(l => l.lightswarm_address);
  }
  if (primaryAddress) {
    return [primaryAddress];
  }
  return [];
}

/**
 * Helper to light an apartment (sends to ALL assigned light IDs)
 */
async function lightApartment(serial, apartment, state, options = {}) {
  const {
    intensity = null,
    fadeTimeMs = null,
    rgb = null
  } = options;

  const defaultFadeTime = parseInt(database.settings.get('default_fade_time_ms') || '500', 10);
  const defaultIntensity = parseInt(database.settings.get('default_intensity') || '200', 10);

  const actualFadeTime = fadeTimeMs ?? defaultFadeTime;
  const color = getStateColor(state, rgb);
  const actualIntensity = intensity ?? color.intensity ?? defaultIntensity;

  const scaledR = Math.round((color.r * actualIntensity) / 255);
  const scaledG = Math.round((color.g * actualIntensity) / 255);
  const scaledB = Math.round((color.b * actualIntensity) / 255);

  const addresses = getApartmentAddresses(apartment.id, apartment.lightswarm_address);
  
  if (addresses.length === 0) {
    throw new Error(`No light addresses assigned to apartment ${apartment.id}`);
  }

  for (const address of addresses) {
    let packet;
    if (actualFadeTime > 0) {
      packet = mdp.packetRgbFadeToColor(address, scaledR, scaledG, scaledB, actualFadeTime);
    } else {
      packet = mdp.packetRgbLevel(address, scaledR, scaledG, scaledB);
    }
    await serial.send(packet);
  }

  database.apartments.updateState(apartment.id, state);

  return {
    id: apartment.id,
    addresses,
    state,
    color: { r: scaledR, g: scaledG, b: scaledB },
    fadeTime: actualFadeTime,
    lightCount: addresses.length
  };
}

/**
 * GET /api/v1/apartments
 * List all apartments
 */
router.get('/', (req, res) => {
  const { tower, floor, floorplate } = req.query;
  
  let apartments;
  if (floorplate) {
    apartments = database.apartments.getByFloorplate(floorplate);
  } else if (tower && floor) {
    apartments = database.apartments.getByFloor(tower, parseInt(floor, 10));
  } else if (tower) {
    apartments = database.apartments.getByTower(tower);
  } else {
    apartments = database.apartments.getAll();
  }

  res.json({ apartments, count: apartments.length });
});

/**
 * GET /api/v1/apartments/:id
 * Get single apartment details including assigned lights
 */
router.get('/:id', (req, res) => {
  const apartment = database.apartments.get(req.params.id);
  if (!apartment) {
    return res.status(404).json({ error: 'Apartment not found', code: 'NOT_FOUND' });
  }
  const lights = database.apartmentLights.getByApartment(req.params.id);
  res.json({
    ...apartment,
    lights,
    lightAddresses: lights.map(l => l.lightswarm_address)
  });
});

/**
 * PUT /api/v1/apartments/:id
 * Light single apartment with state
 */
router.put('/:id', validateApartmentUpdate, async (req, res, next) => {
  try {
    const apartment = database.apartments.get(req.params.id);
    if (!apartment) {
      return res.status(404).json({ error: 'Apartment not found', code: 'NOT_FOUND' });
    }

    const { state = 'SELECTED', intensity, fadeTime, rgb } = req.body;
    const serial = req.app.locals.serial;
    const io = req.app.locals.io;

    const result = await lightApartment(serial, apartment, state, { intensity, fadeTimeMs: fadeTime, rgb });

    io.emit('apartment_updated', result);

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/apartments/batch
 * Light multiple apartments
 */
router.put('/batch', validateBatchUpdate, async (req, res, next) => {
  try {
    const { apartments: apartmentUpdates, state: globalState, intensity: globalIntensity, fadeTime: globalFadeTime } = req.body;
    const serial = req.app.locals.serial;
    const io = req.app.locals.io;

    const results = [];
    const errors = [];

    for (const update of apartmentUpdates) {
      const apartmentId = typeof update === 'string' ? update : update.apartmentId || update.id;
      const apartment = database.apartments.get(apartmentId);
      
      if (!apartment) {
        errors.push({ id: apartmentId, error: 'Not found' });
        continue;
      }

      const state = update.state || globalState || 'SELECTED';
      const intensity = update.intensity ?? globalIntensity;
      const fadeTime = update.fadeTime ?? globalFadeTime;
      const rgb = update.rgb;

      try {
        const result = await lightApartment(serial, apartment, state, { intensity, fadeTimeMs: fadeTime, rgb });
        results.push(result);
      } catch (err) {
        errors.push({ id: apartmentId, error: err.message });
      }
    }

    io.emit('apartments_batch_updated', { results, count: results.length });

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
 * POST /api/v1/apartments/:id/off
 * Turn off single apartment (all assigned lights)
 */
router.post('/:id/off', async (req, res, next) => {
  try {
    const apartment = database.apartments.get(req.params.id);
    if (!apartment) {
      return res.status(404).json({ error: 'Apartment not found', code: 'NOT_FOUND' });
    }

    const serial = req.app.locals.serial;
    const fadeTimeMs = parseInt(database.settings.get('default_fade_time_ms') || '500', 10);
    const fadeParams = mdp.calculateFadeParams(255, 0, fadeTimeMs);
    
    const addresses = getApartmentAddresses(apartment.id, apartment.lightswarm_address);
    
    for (const address of addresses) {
      const packet = mdp.packetFade(address, 0, fadeParams.interval, fadeParams.step);
      await serial.send(packet);
    }

    database.apartments.updateState(apartment.id, 'OFF');

    res.json({ success: true, id: apartment.id, state: 'OFF', addresses, lightCount: addresses.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/apartments/all/off
 * Turn off all apartments
 */
router.post('/all/off', async (req, res, next) => {
  try {
    const serial = req.app.locals.serial;
    
    const packet = mdp.packetBroadcast('off');
    await serial.send(packet);

    res.json({ success: true, message: 'All apartments turned off' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/apartments/all/on
 * Turn on all apartments (white)
 */
router.post('/all/on', async (req, res, next) => {
  try {
    const serial = req.app.locals.serial;
    const { intensity = 200 } = req.body;
    
    const packet = mdp.packetBroadcast('level', intensity);
    await serial.send(packet);

    res.json({ success: true, message: 'All apartments turned on', intensity });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
