/**
 * Floorplates Routes
 * Control lighting for floorplate groups
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
 * GET /api/v1/floorplates
 * List all floorplates
 */
router.get('/', (req, res) => {
  const { tower } = req.query;
  
  let floorplates;
  if (tower) {
    floorplates = database.floorplates.getByTower(tower);
  } else {
    floorplates = database.floorplates.getAll();
  }

  const enriched = floorplates.map(fp => {
    const apartments = database.apartments.getByFloorplate(fp.id);
    return {
      ...fp,
      apartmentCount: apartments.length,
      apartments: apartments.map(a => a.id)
    };
  });

  res.json({ floorplates: enriched, count: enriched.length });
});

/**
 * GET /api/v1/floorplates/:id
 * Get single floorplate details
 */
router.get('/:id', (req, res) => {
  const floorplate = database.floorplates.get(req.params.id);
  if (!floorplate) {
    return res.status(404).json({ error: 'Floorplate not found', code: 'NOT_FOUND' });
  }

  const apartments = database.apartments.getByFloorplate(floorplate.id);
  
  res.json({
    ...floorplate,
    apartments
  });
});

/**
 * PUT /api/v1/floorplates/:id
 * Light entire floorplate
 */
router.put('/:id', async (req, res, next) => {
  try {
    const floorplate = database.floorplates.get(req.params.id);
    if (!floorplate) {
      return res.status(404).json({ error: 'Floorplate not found', code: 'NOT_FOUND' });
    }

    const { state = 'SELECTED', intensity, fadeTime } = req.body;
    const serial = req.app.locals.serial;
    const io = req.app.locals.io;

    const apartments = database.apartments.getByFloorplate(floorplate.id);
    const color = getStateColor(state);
    
    const defaultFadeTime = parseInt(database.settings.get('default_fade_time_ms') || '500', 10);
    const defaultIntensity = parseInt(database.settings.get('default_intensity') || '200', 10);
    
    const actualFadeTime = fadeTime ?? defaultFadeTime;
    const actualIntensity = intensity ?? color.intensity ?? defaultIntensity;

    const scaledR = Math.round((color.r * actualIntensity) / 255);
    const scaledG = Math.round((color.g * actualIntensity) / 255);
    const scaledB = Math.round((color.b * actualIntensity) / 255);

    const results = [];
    for (const apt of apartments) {
      let packet;
      if (actualFadeTime > 0) {
        packet = mdp.packetRgbFadeToColor(apt.lightswarm_address, scaledR, scaledG, scaledB, actualFadeTime);
      } else {
        packet = mdp.packetRgbLevel(apt.lightswarm_address, scaledR, scaledG, scaledB);
      }
      
      await serial.send(packet);
      database.apartments.updateState(apt.id, state);
      results.push({ id: apt.id, address: apt.lightswarm_address });
    }

    io.emit('floorplate_updated', { 
      floorplateId: floorplate.id, 
      state, 
      apartmentsCount: results.length 
    });

    res.json({
      success: true,
      floorplateId: floorplate.id,
      state,
      color: { r: scaledR, g: scaledG, b: scaledB },
      fadeTime: actualFadeTime,
      apartments: results,
      count: results.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/floorplates/batch
 * Light multiple floorplates
 */
router.put('/batch', async (req, res, next) => {
  try {
    const { floorplates: floorplateIds, state = 'SELECTED', intensity, fadeTime } = req.body;
    const serial = req.app.locals.serial;
    const io = req.app.locals.io;

    if (!Array.isArray(floorplateIds) || floorplateIds.length === 0) {
      return res.status(400).json({ error: 'Floorplates array is required', code: 'VALIDATION_ERROR' });
    }

    const results = [];
    const errors = [];

    for (const fpId of floorplateIds) {
      const floorplate = database.floorplates.get(fpId);
      if (!floorplate) {
        errors.push({ id: fpId, error: 'Not found' });
        continue;
      }

      const apartments = database.apartments.getByFloorplate(fpId);
      const color = getStateColor(state);
      
      const defaultFadeTime = parseInt(database.settings.get('default_fade_time_ms') || '500', 10);
      const defaultIntensity = parseInt(database.settings.get('default_intensity') || '200', 10);
      
      const actualFadeTime = fadeTime ?? defaultFadeTime;
      const actualIntensity = intensity ?? color.intensity ?? defaultIntensity;

      const scaledR = Math.round((color.r * actualIntensity) / 255);
      const scaledG = Math.round((color.g * actualIntensity) / 255);
      const scaledB = Math.round((color.b * actualIntensity) / 255);

      for (const apt of apartments) {
        const packet = mdp.packetRgbFadeToColor(apt.lightswarm_address, scaledR, scaledG, scaledB, actualFadeTime);
        await serial.send(packet);
        database.apartments.updateState(apt.id, state);
      }

      results.push({ 
        floorplateId: fpId, 
        apartmentsCount: apartments.length 
      });
    }

    io.emit('floorplates_batch_updated', { results, count: results.length });

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
 * PUT /api/v1/floors/batch
 * Light multiple floors (convenience endpoint)
 */
router.put('/floors/batch', async (req, res, next) => {
  try {
    const { floors, tower, state = 'SELECTED', intensity, fadeTime } = req.body;
    const serial = req.app.locals.serial;
    const io = req.app.locals.io;

    if (!Array.isArray(floors) || floors.length === 0) {
      return res.status(400).json({ error: 'Floors array is required', code: 'VALIDATION_ERROR' });
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
    for (const floor of floors) {
      const apartments = database.apartments.getByFloor(tower || null, floor);
      
      for (const apt of apartments) {
        const packet = mdp.packetRgbFadeToColor(apt.lightswarm_address, scaledR, scaledG, scaledB, actualFadeTime);
        await serial.send(packet);
        database.apartments.updateState(apt.id, state);
      }

      results.push({ floor, apartmentsCount: apartments.length });
    }

    io.emit('floors_batch_updated', { results, count: results.length });

    res.json({
      success: true,
      floors: results,
      state,
      color: { r: scaledR, g: scaledG, b: scaledB },
      count: results.reduce((sum, r) => sum + r.apartmentsCount, 0)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
