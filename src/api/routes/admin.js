/**
 * Admin Routes
 * Configuration, mapping management, and system administration
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { database } = require('../../config');
const mdp = require('../../mdp');
const { excelImport } = require('../../utils');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

// =====================
// Settings Management
// =====================

/**
 * GET /api/v1/admin/settings
 * Get all settings
 */
router.get('/settings', (req, res) => {
  const settings = database.settings.getAll();
  const settingsObj = {};
  settings.forEach(s => {
    settingsObj[s.key] = s.value;
  });
  res.json(settingsObj);
});

/**
 * PUT /api/v1/admin/settings
 * Update settings
 */
router.put('/settings', (req, res) => {
  const updates = req.body;
  
  for (const [key, value] of Object.entries(updates)) {
    database.settings.set(key, String(value));
  }

  req.app.locals.io.emit('settings_updated', updates);

  res.json({ success: true, updated: Object.keys(updates) });
});

/**
 * GET /api/v1/admin/settings/:key
 * Get single setting
 */
router.get('/settings/:key', (req, res) => {
  const value = database.settings.get(req.params.key);
  if (value === null) {
    return res.status(404).json({ error: 'Setting not found', code: 'NOT_FOUND' });
  }
  res.json({ key: req.params.key, value });
});

// =====================
// State Colors Management
// =====================

/**
 * GET /api/v1/admin/colors
 * Get all state colors
 */
router.get('/colors', (req, res) => {
  const colors = database.stateColors.getAll();
  res.json({ colors });
});

/**
 * PUT /api/v1/admin/colors/:state
 * Update state color
 */
router.put('/colors/:state', (req, res) => {
  const { red, green, blue, intensity, description } = req.body;
  
  database.stateColors.set(
    req.params.state.toUpperCase(),
    red, green, blue,
    intensity ?? 200,
    description
  );

  req.app.locals.io.emit('colors_updated', { state: req.params.state });

  res.json({ success: true, state: req.params.state });
});

// =====================
// Towers Management
// =====================

/**
 * GET /api/v1/admin/towers
 * Get all towers
 */
router.get('/towers', (req, res) => {
  const towers = database.towers.getAll();
  res.json({ towers });
});

/**
 * POST /api/v1/admin/towers
 * Create tower
 */
router.post('/towers', (req, res) => {
  const { id, name, totalFloors } = req.body;
  database.towers.create(id, name, totalFloors);
  res.status(201).json({ success: true, id });
});

/**
 * PUT /api/v1/admin/towers/:id
 * Update tower
 */
router.put('/towers/:id', (req, res) => {
  const { name, totalFloors } = req.body;
  database.towers.update(req.params.id, name, totalFloors);
  res.json({ success: true, id: req.params.id });
});

/**
 * DELETE /api/v1/admin/towers/:id
 * Delete tower
 */
router.delete('/towers/:id', (req, res) => {
  database.towers.delete(req.params.id);
  res.json({ success: true });
});

// =====================
// Floorplates Management
// =====================

/**
 * GET /api/v1/admin/floorplates
 * Get all floorplates
 */
router.get('/floorplates', (req, res) => {
  const floorplates = database.floorplates.getAll();
  res.json({ floorplates });
});

/**
 * GET /api/v1/admin/floorplates/:id
 * Get single floorplate with apartments
 */
router.get('/floorplates/:id', (req, res) => {
  const floorplate = database.floorplates.get(req.params.id);
  if (!floorplate) {
    return res.status(404).json({ error: 'Floorplate not found' });
  }
  const apartments = database.apartments.getByFloorplate(req.params.id);
  res.json({ floorplate, apartments });
});

/**
 * POST /api/v1/admin/floorplates
 * Create floorplate
 */
router.post('/floorplates', (req, res) => {
  const { id, name, towerId, floor, pseudoAddress } = req.body;
  database.floorplates.create(id, name, towerId, floor, pseudoAddress);
  res.status(201).json({ success: true, id });
});

/**
 * PUT /api/v1/admin/floorplates/:id
 * Update floorplate
 */
router.put('/floorplates/:id', (req, res) => {
  const { name, pseudoAddress } = req.body;
  database.floorplates.update(req.params.id, name, pseudoAddress);
  res.json({ success: true, id: req.params.id });
});

/**
 * DELETE /api/v1/admin/floorplates/:id
 * Delete floorplate
 */
router.delete('/floorplates/:id', (req, res) => {
  database.floorplates.delete(req.params.id);
  res.json({ success: true });
});

// =====================
// Apartments Management
// =====================

/**
 * POST /api/v1/admin/apartments
 * Create apartment
 */
router.post('/apartments', (req, res) => {
  database.apartments.create(req.body);
  res.status(201).json({ success: true, id: req.body.id });
});

/**
 * PUT /api/v1/admin/apartments/:id
 * Update apartment
 */
router.put('/apartments/:id', (req, res) => {
  database.apartments.update(req.params.id, req.body);
  res.json({ success: true, id: req.params.id });
});

/**
 * DELETE /api/v1/admin/apartments/:id
 * Delete apartment
 */
router.delete('/apartments/:id', (req, res) => {
  database.apartments.delete(req.params.id);
  res.json({ success: true });
});

/**
 * POST /api/v1/admin/apartments/import
 * Bulk import apartments from CSV data
 */
router.post('/apartments/import', (req, res) => {
  const { apartments, clearExisting = false } = req.body;

  if (clearExisting) {
    const existing = database.apartments.getAll();
    existing.forEach(a => database.apartments.delete(a.id));
  }

  database.apartments.bulkCreate(apartments);

  res.json({ success: true, imported: apartments.length });
});

/**
 * GET /api/v1/admin/apartments/export
 * Export all apartments as JSON
 */
router.get('/apartments/export', (req, res) => {
  const apartments = database.apartments.getAll();
  res.json({ apartments, exportedAt: new Date().toISOString() });
});

/**
 * GET /api/v1/admin/apartments/export/excel
 * Export all apartments as Excel file
 */
router.get('/apartments/export/excel', (req, res) => {
  try {
    const buffer = excelImport.exportToExcel(database);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=apartments-export.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/admin/apartments/stats
 * Get apartment statistics
 */
router.get('/apartments/stats', (req, res) => {
  const stats = database.apartments.getStats();
  const floors = database.apartments.getFloors();
  res.json({ ...stats, floors: floors.map(f => f.floor) });
});

/**
 * GET /api/v1/admin/apartments/floors
 * Get list of all floors with apartment counts
 */
router.get('/apartments/floors', (req, res) => {
  const apartments = database.apartments.getAll();
  const floorCounts = {};
  apartments.forEach(apt => {
    floorCounts[apt.floor] = (floorCounts[apt.floor] || 0) + 1;
  });
  const floors = Object.entries(floorCounts)
    .map(([floor, count]) => ({ floor: parseInt(floor, 10), count }))
    .sort((a, b) => a.floor - b.floor);
  res.json({ floors });
});

/**
 * GET /api/v1/admin/apartments/by-floor/:floor
 * Get all apartments on a specific floor
 */
router.get('/apartments/by-floor/:floor', (req, res) => {
  const floor = parseInt(req.params.floor, 10);
  const apartments = database.apartments.getByFloorOnly(floor);
  const lightsMap = {};
  apartments.forEach(apt => {
    lightsMap[apt.id] = database.apartmentLights.getByApartment(apt.id);
  });
  res.json({ 
    floor, 
    apartments, 
    lights: lightsMap,
    count: apartments.length 
  });
});

// =====================
// Excel Import
// =====================

/**
 * POST /api/v1/admin/import/excel
 * Upload and import Excel file
 */
router.post('/import/excel', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const clearExisting = req.body.clearExisting === 'true';
    
    const parsed = excelImport.parseExcelFile(req.file.buffer);
    const results = await excelImport.importToDatabase(database, parsed.apartments, {
      clearExisting,
      createFloorplates: true,
      createTower: true
    });

    req.app.locals.io?.emit('apartments_imported', { 
      count: results.imported + results.updated,
      floors: parsed.stats.floors.length 
    });

    res.json({
      success: true,
      ...results,
      stats: parsed.stats
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/import/excel/validate
 * Validate Excel file before import
 */
router.post('/import/excel/validate', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const validation = excelImport.validateExcelFile(req.file.buffer);
    res.json(validation);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/import/excel/preview
 * Preview Excel file contents
 */
router.post('/import/excel/preview', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const parsed = excelImport.parseExcelFile(req.file.buffer);
    const preview = parsed.apartments.slice(0, 20);
    
    res.json({
      preview,
      stats: parsed.stats,
      errors: parsed.errors.slice(0, 10),
      columns: parsed.columns
    });
  } catch (err) {
    next(err);
  }
});

// =====================
// Apartment Lights Management
// =====================

/**
 * GET /api/v1/admin/apartments/:id/lights
 * Get all lights for an apartment
 */
router.get('/apartments/:id/lights', (req, res) => {
  const apartment = database.apartments.get(req.params.id);
  if (!apartment) {
    return res.status(404).json({ error: 'Apartment not found' });
  }
  
  const lights = database.apartmentLights.getByApartment(req.params.id);
  res.json({ 
    apartmentId: req.params.id, 
    lights,
    addresses: lights.map(l => l.lightswarm_address)
  });
});

/**
 * PUT /api/v1/admin/apartments/:id/lights
 * Update all light assignments for an apartment
 */
router.put('/apartments/:id/lights', (req, res) => {
  const apartment = database.apartments.get(req.params.id);
  if (!apartment) {
    return res.status(404).json({ error: 'Apartment not found' });
  }

  const { addresses } = req.body;
  if (!Array.isArray(addresses)) {
    return res.status(400).json({ error: 'addresses must be an array' });
  }

  database.apartmentLights.setLights(req.params.id, addresses);
  
  if (addresses.length > 0) {
    database.apartments.update(req.params.id, { lightswarmAddress: addresses[0] });
  }

  req.app.locals.io?.emit('apartment_lights_updated', { 
    apartmentId: req.params.id, 
    addresses 
  });

  res.json({ success: true, apartmentId: req.params.id, addresses });
});

/**
 * POST /api/v1/admin/apartments/:id/lights
 * Add a light to an apartment
 */
router.post('/apartments/:id/lights', (req, res) => {
  const apartment = database.apartments.get(req.params.id);
  if (!apartment) {
    return res.status(404).json({ error: 'Apartment not found' });
  }

  const { lightIndex, address } = req.body;
  if (lightIndex === undefined || address === undefined) {
    return res.status(400).json({ error: 'lightIndex and address are required' });
  }

  database.apartmentLights.add(req.params.id, lightIndex, address);
  
  if (lightIndex === 1) {
    database.apartments.update(req.params.id, { lightswarmAddress: address });
  }

  res.json({ success: true, apartmentId: req.params.id, lightIndex, address });
});

/**
 * DELETE /api/v1/admin/apartments/:id/lights/:index
 * Remove a light from an apartment
 */
router.delete('/apartments/:id/lights/:index', (req, res) => {
  const apartment = database.apartments.get(req.params.id);
  if (!apartment) {
    return res.status(404).json({ error: 'Apartment not found' });
  }

  database.apartmentLights.remove(req.params.id, parseInt(req.params.index, 10));
  res.json({ success: true });
});

/**
 * GET /api/v1/admin/lights/unassigned
 * Get apartments without light assignments
 */
router.get('/lights/unassigned', (req, res) => {
  const unassigned = database.apartmentLights.getUnassignedApartments();
  res.json({ apartments: unassigned, count: unassigned.length });
});

/**
 * GET /api/v1/admin/lights/assigned
 * Get apartments with light assignments
 */
router.get('/lights/assigned', (req, res) => {
  const assigned = database.apartmentLights.getAssignedApartments();
  res.json({ apartments: assigned, count: assigned.length });
});

/**
 * POST /api/v1/admin/lights/bulk-assign
 * Bulk assign lights to apartments
 */
router.post('/lights/bulk-assign', (req, res) => {
  const { assignments } = req.body;
  if (!Array.isArray(assignments)) {
    return res.status(400).json({ error: 'assignments must be an array' });
  }

  let updated = 0;
  for (const { apartmentId, addresses } of assignments) {
    const apartment = database.apartments.get(apartmentId);
    if (apartment && Array.isArray(addresses)) {
      database.apartmentLights.setLights(apartmentId, addresses);
      if (addresses.length > 0) {
        database.apartments.update(apartmentId, { lightswarmAddress: addresses[0] });
      }
      updated++;
    }
  }

  req.app.locals.io?.emit('lights_bulk_updated', { count: updated });

  res.json({ success: true, updated });
});

// =====================
// Amenities Management
// =====================

/**
 * POST /api/v1/admin/amenities
 * Create amenity
 */
router.post('/amenities', (req, res) => {
  database.amenities.create(req.body);
  res.status(201).json({ success: true, id: req.body.id });
});

/**
 * PUT /api/v1/admin/amenities/:id
 * Update amenity
 */
router.put('/amenities/:id', (req, res) => {
  database.amenities.update(req.params.id, req.body);
  res.json({ success: true, id: req.params.id });
});

/**
 * DELETE /api/v1/admin/amenities/:id
 * Delete amenity
 */
router.delete('/amenities/:id', (req, res) => {
  database.amenities.delete(req.params.id);
  res.json({ success: true });
});

// =====================
// Animation Sequences
// =====================

/**
 * GET /api/v1/admin/animations
 * Get all animation sequences
 */
router.get('/animations', (req, res) => {
  const sequences = database.animationSequences.getAll();
  res.json({ sequences });
});

/**
 * GET /api/v1/admin/animations/:id
 * Get single animation sequence
 */
router.get('/animations/:id', (req, res) => {
  const sequence = database.animationSequences.get(req.params.id);
  if (!sequence) {
    return res.status(404).json({ error: 'Animation not found', code: 'NOT_FOUND' });
  }
  res.json(sequence);
});

/**
 * POST /api/v1/admin/animations
 * Create animation sequence
 */
router.post('/animations', (req, res) => {
  database.animationSequences.create(req.body);
  res.status(201).json({ success: true, id: req.body.id });
});

/**
 * PUT /api/v1/admin/animations/:id
 * Update animation sequence
 */
router.put('/animations/:id', (req, res) => {
  database.animationSequences.update(req.params.id, req.body);
  res.json({ success: true, id: req.params.id });
});

/**
 * PUT /api/v1/admin/animations/:id/set-ambient
 * Set as default ambient animation
 */
router.put('/animations/:id/set-ambient', (req, res) => {
  database.animationSequences.setAsAmbientDefault(req.params.id);
  database.settings.set('ambient_sequence_id', req.params.id);
  res.json({ success: true, id: req.params.id });
});

/**
 * DELETE /api/v1/admin/animations/:id
 * Delete animation sequence
 */
router.delete('/animations/:id', (req, res) => {
  database.animationSequences.delete(req.params.id);
  res.json({ success: true });
});

// =====================
// Logs & Diagnostics
// =====================

/**
 * GET /api/v1/admin/logs
 * Get command logs
 */
router.get('/logs', (req, res) => {
  const { limit = 100, source, startTime, endTime } = req.query;

  let logs;
  if (startTime && endTime) {
    logs = database.commandLog.getByTimeRange(startTime, endTime);
  } else if (source) {
    logs = database.commandLog.getBySource(source, parseInt(limit, 10));
  } else {
    logs = database.commandLog.getRecent(parseInt(limit, 10));
  }

  res.json({ logs, count: logs.length });
});

/**
 * GET /api/v1/admin/logs/stats
 * Get log statistics
 */
router.get('/logs/stats', (req, res) => {
  const stats = database.commandLog.getStats();
  res.json(stats);
});

/**
 * DELETE /api/v1/admin/logs
 * Clean up old logs
 */
router.delete('/logs', (req, res) => {
  const { daysToKeep = 30 } = req.query;
  const result = database.commandLog.cleanup(parseInt(daysToKeep, 10));
  res.json({ success: true, deleted: result.changes });
});

/**
 * GET /api/v1/admin/sessions
 * Get session logs
 */
router.get('/sessions', (req, res) => {
  const { limit = 50 } = req.query;
  const sessions = database.sessionLog.getRecent(parseInt(limit, 10));
  res.json({ sessions, count: sessions.length });
});

// =====================
// Serial Port Management
// =====================

/**
 * GET /api/v1/admin/serial/ports
 * List available serial ports
 */
router.get('/serial/ports', async (req, res) => {
  const ports = await mdp.SerialConnection.listPorts();
  res.json({ ports });
});

/**
 * GET /api/v1/admin/serial/status
 * Get serial connection status
 */
router.get('/serial/status', (req, res) => {
  const serial = req.app.locals.serial;
  res.json(serial.getStatus());
});

/**
 * POST /api/v1/admin/serial/reconnect
 * Reconnect serial port
 */
router.post('/serial/reconnect', async (req, res, next) => {
  try {
    const serial = req.app.locals.serial;
    await serial.close();
    await serial.connect();
    res.json({ success: true, status: serial.getStatus() });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/admin/serial/simulation
 * Enable/disable simulation mode
 */
router.put('/serial/simulation', (req, res) => {
  const { enabled } = req.body;
  const serial = req.app.locals.serial;
  serial.setSimulationMode(enabled);
  database.settings.set('simulation_mode', String(enabled));
  res.json({ success: true, simulationMode: enabled });
});

// =====================
// Lights Lookup
// =====================

/**
 * GET /api/v1/admin/lights/by-address/:address
 * Look up apartment by lightswarm address (for stacking model highlight)
 */
router.get('/lights/by-address/:address', (req, res) => {
  const address = parseInt(req.params.address, 10);
  if (isNaN(address) || address < 0 || address > 65535) {
    return res.status(400).json({ error: 'Invalid address', code: 'INVALID_ADDRESS' });
  }

  // First check apartment_lights (primary source)
  const lightRow = database.apartmentLights.getByAddress(address);
  if (lightRow) {
    const apartment = database.apartments.get(lightRow.apartment_id);
    if (apartment) {
      return res.json({
        apartment: {
          id: apartment.id,
          name: apartment.name,
          floor: apartment.floor,
          unit_position: apartment.unit_position,
          plot_number: apartment.plot_number
        }
      });
    }
  }

  // Fallback: apartments.lightswarm_address
  const apartment = database.apartments.getByAddress(address);
  if (apartment) {
    return res.json({
      apartment: {
        id: apartment.id,
        name: apartment.name,
        floor: apartment.floor,
        unit_position: apartment.unit_position,
        plot_number: apartment.plot_number
      }
    });
  }

  res.json({ apartment: null });
});

// =====================
// Test Commands
// =====================

/**
 * POST /api/v1/admin/test/address
 * Send test command to specific address
 */
router.post('/test/address', async (req, res, next) => {
  try {
    const { address, command = 'on', red, green, blue, level, fadeTime } = req.body;
    const serial = req.app.locals.serial;

    let packet;
    switch (command) {
      case 'on':
        packet = mdp.packetOn(address);
        break;
      case 'off':
        packet = mdp.packetOff(address);
        break;
      case 'level':
        packet = mdp.packetLevel(address, level ?? 255);
        break;
      case 'rgb':
        packet = mdp.packetRgbLevel(address, red ?? 255, green ?? 255, blue ?? 255);
        break;
      case 'fade':
        const fadeParams = mdp.calculateFadeParams(0, level ?? 255, fadeTime ?? 500);
        packet = mdp.packetFade(address, level ?? 255, fadeParams.interval, fadeParams.step);
        break;
      case 'rgb_fade':
        packet = mdp.packetRgbFadeToColor(address, red ?? 255, green ?? 255, blue ?? 255, fadeTime ?? 500);
        break;
      default:
        return res.status(400).json({ error: 'Invalid command', code: 'INVALID_COMMAND' });
    }

    await serial.send(packet);

    res.json({
      success: true,
      address,
      command,
      packetHex: mdp.packetToHex(packet)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/test/broadcast
 * Send broadcast command
 */
router.post('/test/broadcast', async (req, res, next) => {
  try {
    const { command = 'off', level } = req.body;
    const serial = req.app.locals.serial;

    const packet = mdp.packetBroadcast(command, level);
    await serial.send(packet);

    res.json({
      success: true,
      command,
      packetHex: mdp.packetToHex(packet)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/test/raw
 * Send raw hex command (for debugging)
 */
router.post('/test/raw', async (req, res, next) => {
  try {
    const { hex } = req.body;
    const serial = req.app.locals.serial;

    const bytes = hex.split(' ').map(h => parseInt(h, 16));
    const buffer = Buffer.from(bytes);
    await serial.send(buffer);

    res.json({
      success: true,
      sent: hex
    });
  } catch (err) {
    next(err);
  }
});

// =====================
// Simulator Endpoints
// =====================

/**
 * GET /api/v1/admin/simulator/status
 * Get simulator status and stats
 */
router.get('/simulator/status', (req, res) => {
  const simulator = req.app.locals.simulator;
  if (!simulator) {
    return res.json({ enabled: false, available: false });
  }
  res.json({
    available: true,
    ...simulator.getStats()
  });
});

/**
 * GET /api/v1/admin/simulator/lights
 * Get all simulated light states
 */
router.get('/simulator/lights', (req, res) => {
  const simulator = req.app.locals.simulator;
  if (!simulator) {
    return res.json({ lights: [], enabled: false });
  }
  
  const { floor } = req.query;
  let lights;
  
  if (floor) {
    lights = simulator.getLightsByFloor(parseInt(floor, 10));
  } else {
    lights = simulator.getAllStates();
  }
  
  res.json({ lights, count: lights.length, enabled: simulator.enabled });
});

/**
 * GET /api/v1/admin/simulator/lights/:address
 * Get single light state
 */
router.get('/simulator/lights/:address', (req, res) => {
  const simulator = req.app.locals.simulator;
  if (!simulator) {
    return res.status(404).json({ error: 'Simulator not available' });
  }
  
  const state = simulator.getState(parseInt(req.params.address, 10));
  if (!state) {
    return res.status(404).json({ error: 'Light not found' });
  }
  
  res.json(state);
});

/**
 * POST /api/v1/admin/simulator/reset
 * Reset all simulated lights to off
 */
router.post('/simulator/reset', (req, res) => {
  const simulator = req.app.locals.simulator;
  if (!simulator) {
    return res.status(404).json({ error: 'Simulator not available' });
  }
  
  simulator.resetAll();
  res.json({ success: true, message: 'All lights reset to off' });
});

/**
 * GET /api/v1/admin/simulator/export
 * Export current simulator state
 */
router.get('/simulator/export', (req, res) => {
  const simulator = req.app.locals.simulator;
  if (!simulator) {
    return res.status(404).json({ error: 'Simulator not available' });
  }
  
  res.json(simulator.exportState());
});

module.exports = router;
