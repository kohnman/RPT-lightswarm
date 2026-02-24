/**
 * Database Manager
 * SQLite database for configuration, mappings, and logs
 * Uses sql.js (WebAssembly-based SQLite) for cross-platform compatibility
 */

const path = require('path');
const fs = require('fs');

let db = null;
let dbPath = null;
let SQL = null;

/**
 * Run database migrations to add new columns/tables
 */
function runMigrations() {
  const migrations = [
    { col: 'hubspot_id', sql: 'ALTER TABLE apartments ADD COLUMN hubspot_id TEXT' },
    { col: 'plot_number', sql: 'ALTER TABLE apartments ADD COLUMN plot_number INTEGER' },
    { col: 'unit_type', sql: 'ALTER TABLE apartments ADD COLUMN unit_type TEXT' },
    { col: 'unit_position', sql: 'ALTER TABLE apartments ADD COLUMN unit_position INTEGER' }
  ];
  
  for (const m of migrations) {
    try {
      db.exec(m.sql);
      console.log(`      Added column: ${m.col}`);
    } catch (e) {
      // Column already exists, ignore
    }
  }
  
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS apartment_lights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        apartment_id TEXT NOT NULL,
        light_index INTEGER NOT NULL,
        lightswarm_address INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        UNIQUE(apartment_id, light_index)
      )
    `);
    console.log('      Created table: apartment_lights');
  } catch (e) {
    // Table already exists
  }
  
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_apartment_lights_apartment ON apartment_lights(apartment_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_apartment_lights_address ON apartment_lights(lightswarm_address)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_apartments_plot ON apartments(plot_number)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_apartments_hubspot ON apartments(hubspot_id)');
  } catch (e) {
    // Indexes already exist
  }
  
  // Make lightswarm_address nullable for apartments without assigned lights
  // SQLite doesn't support ALTER COLUMN, so we need to handle this in application code
}

/**
 * Save database to disk
 */
function saveToFile() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * Initialize the database connection
 * @param {string} customPath - Path to the database file
 */
async function initialize(customPath = null) {
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs();
  
  const defaultPath = path.join(__dirname, '../../data/middleware.db');
  dbPath = customPath || defaultPath;
  
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  try {
    db.exec(schema);
  } catch (schemaErr) {
    console.log('      Schema already exists, running migrations...');
    runMigrations();
  }
  
  saveToFile();

  return db;
}

/**
 * Synchronous initialize (for compatibility)
 */
function initializeSync(customPath = null) {
  return initialize(customPath);
}

/**
 * Get database instance
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initialize() first.');
  }
  return db;
}

/**
 * Close database connection
 */
function close() {
  if (db) {
    saveToFile();
    db.close();
    db = null;
  }
}

/**
 * Helper to run a query and return all results
 */
function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const cleanParams = params.filter(p => p !== undefined);
    if (cleanParams.length > 0) {
      stmt.bind(cleanParams);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('Database query error:', sql, params, err.message);
    return [];
  }
}

/**
 * Helper to run a query and return first result
 */
function queryOne(sql, params = []) {
  try {
    const results = queryAll(sql, params);
    return results.length > 0 ? results[0] : null;
  } catch (err) {
    console.error('Database queryOne error:', sql, params, err.message);
    return null;
  }
}

/**
 * Helper to run an insert/update/delete
 */
function run(sql, params = []) {
  try {
    const cleanParams = params.map(p => p === undefined ? null : p);
    db.run(sql, cleanParams);
    saveToFile();
    return { changes: db.getRowsModified(), lastInsertRowid: null };
  } catch (err) {
    console.error('Database run error:', sql, params, err.message);
    return { changes: 0, lastInsertRowid: null };
  }
}

// Settings operations
const settings = {
  get(key) {
    const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : null;
  },

  getAll() {
    return queryAll('SELECT * FROM settings');
  },

  set(key, value, description = null) {
    return run(`
      INSERT INTO settings (key, value, description, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `, [key, value, description, value]);
  },

  delete(key) {
    return run('DELETE FROM settings WHERE key = ?', [key]);
  }
};

// State colors operations
const stateColors = {
  get(stateName) {
    return queryOne('SELECT * FROM state_colors WHERE state_name = ?', [stateName]);
  },

  getAll() {
    return queryAll('SELECT * FROM state_colors');
  },

  set(stateName, red, green, blue, intensity = 255, description = null) {
    return run(`
      INSERT INTO state_colors (state_name, red, green, blue, intensity, description, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(state_name) DO UPDATE SET 
        red = ?, green = ?, blue = ?, intensity = ?, description = ?, updated_at = datetime('now')
    `, [stateName, red, green, blue, intensity, description, red, green, blue, intensity, description]);
  },

  delete(stateName) {
    return run('DELETE FROM state_colors WHERE state_name = ?', [stateName]);
  }
};

// Towers operations
const towers = {
  get(id) {
    return queryOne('SELECT * FROM towers WHERE id = ?', [id]);
  },

  getAll() {
    return queryAll('SELECT * FROM towers ORDER BY name');
  },

  create(id, name, totalFloors) {
    return run('INSERT INTO towers (id, name, total_floors) VALUES (?, ?, ?)', [id, name, totalFloors]);
  },

  update(id, name, totalFloors) {
    return run('UPDATE towers SET name = ?, total_floors = ? WHERE id = ?', [name, totalFloors, id]);
  },

  delete(id) {
    return run('DELETE FROM towers WHERE id = ?', [id]);
  }
};

// Floorplates operations
const floorplates = {
  get(id) {
    return queryOne('SELECT * FROM floorplates WHERE id = ?', [id]);
  },

  getAll() {
    return queryAll('SELECT * FROM floorplates ORDER BY tower_id, floor');
  },

  getByTower(towerId) {
    return queryAll('SELECT * FROM floorplates WHERE tower_id = ? ORDER BY floor', [towerId]);
  },

  getByFloor(towerId, floor) {
    return queryOne('SELECT * FROM floorplates WHERE tower_id = ? AND floor = ?', [towerId, floor]);
  },

  create(id, name, towerId, floor, pseudoAddress = null) {
    return run(
      'INSERT INTO floorplates (id, name, tower_id, floor, pseudo_address) VALUES (?, ?, ?, ?, ?)',
      [id, name, towerId, floor, pseudoAddress]
    );
  },

  update(id, name, pseudoAddress) {
    return run('UPDATE floorplates SET name = ?, pseudo_address = ? WHERE id = ?', [name, pseudoAddress, id]);
  },

  delete(id) {
    return run('DELETE FROM floorplates WHERE id = ?', [id]);
  }
};

// Apartments operations
const apartments = {
  get(id) {
    return queryOne('SELECT * FROM apartments WHERE id = ?', [id]);
  },

  getByAddress(address) {
    return queryOne('SELECT * FROM apartments WHERE lightswarm_address = ?', [address]);
  },

  getByPlotNumber(plotNumber) {
    return queryOne('SELECT * FROM apartments WHERE plot_number = ?', [plotNumber]);
  },

  getByHubspotId(hubspotId) {
    return queryOne('SELECT * FROM apartments WHERE hubspot_id = ?', [hubspotId]);
  },

  getAll() {
    return queryAll('SELECT * FROM apartments ORDER BY tower_id, floor, unit_position');
  },

  getByTower(towerId) {
    return queryAll('SELECT * FROM apartments WHERE tower_id = ? ORDER BY floor, unit_position', [towerId]);
  },

  getByFloor(towerId, floor) {
    return queryAll('SELECT * FROM apartments WHERE tower_id = ? AND floor = ? ORDER BY unit_position', [towerId, floor]);
  },

  getByFloorOnly(floor) {
    return queryAll('SELECT * FROM apartments WHERE floor = ? ORDER BY unit_position', [floor]);
  },

  getByFloorplate(floorplateId) {
    return queryAll('SELECT * FROM apartments WHERE floorplate_id = ? ORDER BY unit_position', [floorplateId]);
  },

  create(data) {
    return run(`
      INSERT INTO apartments (id, name, lightswarm_address, tower_id, floor, floorplate_id, unit_number, current_state, hubspot_id, plot_number, unit_type, unit_position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.id, data.name, data.lightswarmAddress || null, data.towerId, 
      data.floor, data.floorplateId || null, data.unitNumber, data.currentState || 'AVAILABLE',
      data.hubspotId || null, data.plotNumber || null, data.unitType || null, data.unitPosition || null
    ]);
  },

  update(id, data) {
    const apt = apartments.get(id);
    if (!apt) return { changes: 0 };
    
    return run(`
      UPDATE apartments SET 
        name = ?,
        lightswarm_address = ?,
        floor = ?,
        floorplate_id = ?,
        unit_number = ?,
        current_state = ?,
        hubspot_id = ?,
        plot_number = ?,
        unit_type = ?,
        unit_position = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      data.name !== undefined ? data.name : apt.name,
      data.lightswarmAddress !== undefined ? data.lightswarmAddress : apt.lightswarm_address,
      data.floor !== undefined ? data.floor : apt.floor,
      data.floorplateId !== undefined ? data.floorplateId : apt.floorplate_id,
      data.unitNumber !== undefined ? data.unitNumber : apt.unit_number,
      data.currentState !== undefined ? data.currentState : apt.current_state,
      data.hubspotId !== undefined ? data.hubspotId : apt.hubspot_id,
      data.plotNumber !== undefined ? data.plotNumber : apt.plot_number,
      data.unitType !== undefined ? data.unitType : apt.unit_type,
      data.unitPosition !== undefined ? data.unitPosition : apt.unit_position,
      id
    ]);
  },

  updateState(id, state) {
    return run('UPDATE apartments SET current_state = ?, updated_at = datetime(\'now\') WHERE id = ?', [state, id]);
  },

  delete(id) {
    run('DELETE FROM apartment_lights WHERE apartment_id = ?', [id]);
    return run('DELETE FROM apartments WHERE id = ?', [id]);
  },

  deleteAll() {
    run('DELETE FROM apartment_lights');
    return run('DELETE FROM apartments');
  },

  bulkCreate(apartmentsData) {
    let created = 0;
    for (const item of apartmentsData) {
      const params = [
        item.id, item.name, item.lightswarmAddress || null, item.towerId,
        item.floor, item.floorplateId || null, item.unitNumber, item.currentState || 'AVAILABLE',
        item.hubspotId || null, item.plotNumber || null, item.unitType || null, item.unitPosition || null
      ].map(p => p === undefined ? null : p);
      try {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO apartments (id, name, lightswarm_address, tower_id, floor, floorplate_id, unit_number, current_state, hubspot_id, plot_number, unit_type, unit_position)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.bind(params);
        stmt.step();
        stmt.free();
        created++;
      } catch (err) {
        console.error('bulkCreate error:', item.id, err.message);
      }
    }
    saveToFile();
    return { changes: created };
  },

  getFloorRange() {
    const result = queryOne('SELECT MIN(floor) as min_floor, MAX(floor) as max_floor FROM apartments');
    return result || { min_floor: 0, max_floor: 0 };
  },

  getFloors() {
    return queryAll('SELECT DISTINCT floor FROM apartments ORDER BY floor');
  },

  getStats() {
    return queryOne(`
      SELECT 
        COUNT(*) as total_apartments,
        COUNT(DISTINCT floor) as total_floors,
        COUNT(DISTINCT unit_type) as unit_types,
        (SELECT COUNT(*) FROM apartment_lights) as assigned_lights
      FROM apartments
    `);
  }
};

// Apartment lights operations (multiple lights per apartment)
const apartmentLights = {
  getByApartment(apartmentId) {
    return queryAll('SELECT * FROM apartment_lights WHERE apartment_id = ? ORDER BY light_index', [apartmentId]);
  },

  getByAddress(address) {
    return queryOne('SELECT * FROM apartment_lights WHERE lightswarm_address = ?', [address]);
  },

  getAll() {
    return queryAll('SELECT * FROM apartment_lights ORDER BY apartment_id, light_index');
  },

  add(apartmentId, lightIndex, lightswarmAddress) {
    return run(`
      INSERT OR REPLACE INTO apartment_lights (apartment_id, light_index, lightswarm_address)
      VALUES (?, ?, ?)
    `, [apartmentId, lightIndex, lightswarmAddress]);
  },

  update(apartmentId, lightIndex, lightswarmAddress) {
    return run(`
      UPDATE apartment_lights SET lightswarm_address = ? 
      WHERE apartment_id = ? AND light_index = ?
    `, [lightswarmAddress, apartmentId, lightIndex]);
  },

  remove(apartmentId, lightIndex) {
    return run('DELETE FROM apartment_lights WHERE apartment_id = ? AND light_index = ?', [apartmentId, lightIndex]);
  },

  removeAll(apartmentId) {
    return run('DELETE FROM apartment_lights WHERE apartment_id = ?', [apartmentId]);
  },

  setLights(apartmentId, addresses) {
    run('DELETE FROM apartment_lights WHERE apartment_id = ?', [apartmentId]);
    for (let i = 0; i < addresses.length; i++) {
      if (addresses[i] !== null && addresses[i] !== undefined) {
        db.run(`
          INSERT INTO apartment_lights (apartment_id, light_index, lightswarm_address)
          VALUES (?, ?, ?)
        `, [apartmentId, i + 1, addresses[i]]);
      }
    }
    saveToFile();
    return { changes: addresses.length };
  },

  getAddressesForApartment(apartmentId) {
    const lights = queryAll('SELECT lightswarm_address FROM apartment_lights WHERE apartment_id = ? ORDER BY light_index', [apartmentId]);
    return lights.map(l => l.lightswarm_address);
  },

  getUnassignedApartments() {
    return queryAll(`
      SELECT a.* FROM apartments a 
      LEFT JOIN apartment_lights al ON a.id = al.apartment_id 
      WHERE al.id IS NULL
      ORDER BY a.floor, a.unit_position
    `);
  },

  getAssignedApartments() {
    return queryAll(`
      SELECT DISTINCT a.* FROM apartments a 
      INNER JOIN apartment_lights al ON a.id = al.apartment_id 
      ORDER BY a.floor, a.unit_position
    `);
  }
};

// Amenities operations
const amenities = {
  get(id) {
    return queryOne('SELECT * FROM amenities WHERE id = ?', [id]);
  },

  getAll() {
    return queryAll('SELECT * FROM amenities ORDER BY tower_id, floor, name');
  },

  getByFloor(towerId, floor) {
    return queryAll('SELECT * FROM amenities WHERE tower_id = ? AND floor = ?', [towerId, floor]);
  },

  getByType(amenityType) {
    return queryAll('SELECT * FROM amenities WHERE amenity_type = ?', [amenityType]);
  },

  create(data) {
    return run(`
      INSERT INTO amenities (id, name, lightswarm_address, tower_id, floor, amenity_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [data.id, data.name, data.lightswarmAddress, data.towerId, data.floor, data.amenityType]);
  },

  update(id, data) {
    const amenity = amenities.get(id);
    if (!amenity) return { changes: 0 };
    
    return run(`
      UPDATE amenities SET 
        name = ?,
        lightswarm_address = ?,
        floor = ?,
        amenity_type = ?
      WHERE id = ?
    `, [
      data.name !== undefined ? data.name : amenity.name,
      data.lightswarmAddress !== undefined ? data.lightswarmAddress : amenity.lightswarm_address,
      data.floor !== undefined ? data.floor : amenity.floor,
      data.amenityType !== undefined ? data.amenityType : amenity.amenity_type,
      id
    ]);
  },

  delete(id) {
    return run('DELETE FROM amenities WHERE id = ?', [id]);
  }
};

// Animation sequences operations
const animationSequences = {
  get(id) {
    return queryOne('SELECT * FROM animation_sequences WHERE id = ?', [id]);
  },

  getAll() {
    return queryAll('SELECT * FROM animation_sequences ORDER BY name');
  },

  getAmbientDefault() {
    return queryOne('SELECT * FROM animation_sequences WHERE is_ambient_default = 1');
  },

  create(data) {
    return run(`
      INSERT INTO animation_sequences (id, name, description, sequence_data, is_ambient_default)
      VALUES (?, ?, ?, ?, ?)
    `, [data.id, data.name, data.description, JSON.stringify(data.sequenceData), data.isAmbientDefault ? 1 : 0]);
  },

  update(id, data) {
    const seq = animationSequences.get(id);
    if (!seq) return { changes: 0 };
    
    return run(`
      UPDATE animation_sequences SET 
        name = ?,
        description = ?,
        sequence_data = ?,
        is_ambient_default = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      data.name !== undefined ? data.name : seq.name,
      data.description !== undefined ? data.description : seq.description,
      data.sequenceData !== undefined ? JSON.stringify(data.sequenceData) : seq.sequence_data,
      data.isAmbientDefault !== undefined ? (data.isAmbientDefault ? 1 : 0) : seq.is_ambient_default,
      id
    ]);
  },

  setAsAmbientDefault(id) {
    db.run('UPDATE animation_sequences SET is_ambient_default = 0');
    const result = run('UPDATE animation_sequences SET is_ambient_default = 1 WHERE id = ?', [id]);
    return result;
  },

  delete(id) {
    return run('DELETE FROM animation_sequences WHERE id = ?', [id]);
  }
};

// Command log operations
const commandLog = {
  add(data) {
    return run(`
      INSERT INTO command_log (source, command_type, target_id, target_address, request_data, response_data, success, error_message, execution_time_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.source, data.commandType, data.targetId, data.targetAddress,
      data.requestData ? JSON.stringify(data.requestData) : null,
      data.responseData ? JSON.stringify(data.responseData) : null,
      data.success ? 1 : 0, data.errorMessage, data.executionTimeMs
    ]);
  },

  getRecent(limit = 100) {
    return queryAll('SELECT * FROM command_log ORDER BY timestamp DESC LIMIT ?', [limit]);
  },

  getByTimeRange(startTime, endTime) {
    return queryAll(
      'SELECT * FROM command_log WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC',
      [startTime, endTime]
    );
  },

  getBySource(source, limit = 100) {
    return queryAll(
      'SELECT * FROM command_log WHERE source = ? ORDER BY timestamp DESC LIMIT ?',
      [source, limit]
    );
  },

  cleanup(daysToKeep = 30) {
    return run(
      "DELETE FROM command_log WHERE timestamp < datetime('now', '-' || ? || ' days')",
      [daysToKeep]
    );
  },

  getStats() {
    return queryOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        AVG(execution_time_ms) as avg_execution_time
      FROM command_log
      WHERE timestamp > datetime('now', '-1 day')
    `);
  }
};

// Session log operations
const sessionLog = {
  add(eventType, agentId = null, details = null) {
    return run(
      'INSERT INTO session_log (event_type, agent_id, details) VALUES (?, ?, ?)',
      [eventType, agentId, details ? JSON.stringify(details) : null]
    );
  },

  getRecent(limit = 50) {
    return queryAll('SELECT * FROM session_log ORDER BY timestamp DESC LIMIT ?', [limit]);
  }
};

module.exports = {
  initialize,
  initializeSync,
  getDb,
  close,
  settings,
  stateColors,
  towers,
  floorplates,
  apartments,
  apartmentLights,
  amenities,
  animationSequences,
  commandLog,
  sessionLog
};
