/**
 * Excel Import Utility
 * Parses River Park Tower apartment matrix from Excel files
 */

const XLSX = require('xlsx');
const path = require('path');

const COLUMN_MAPPINGS = {
  'Record ID Hubspot': 'hubspotId',
  'Apartment': 'name',
  'Plot Number': 'plotNumber',
  'Level (floorplate)': 'floor',
  'Unit Type': 'unitType',
  'Unit No.': 'unitPosition',
  "Lighting ID's NO.1": 'lightId1',
  "Lighting ID's NO.2": 'lightId2',
  "Lighting ID's NO.3": 'lightId3',
  'Brightness Level R': 'brightnessR',
  'Brightness Level G': 'brightnessG',
  'Brightness Level B': 'brightnessB'
};

/**
 * Parse an Excel file and extract apartment data
 * @param {string|Buffer} filePathOrBuffer - Path to Excel file or buffer
 * @returns {Object} Parsed data with apartments and metadata
 */
function parseExcelFile(filePathOrBuffer) {
  let workbook;
  
  if (Buffer.isBuffer(filePathOrBuffer)) {
    workbook = XLSX.read(filePathOrBuffer, { type: 'buffer' });
  } else {
    workbook = XLSX.readFile(filePathOrBuffer);
  }
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  const apartments = [];
  const errors = [];
  const stats = {
    totalRows: rawData.length,
    validRows: 0,
    skippedRows: 0,
    floors: new Set(),
    unitTypes: new Set()
  };
  
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 2;
    
    try {
      const apartment = mapRowToApartment(row, rowNum);
      
      if (!apartment) {
        stats.skippedRows++;
        continue;
      }
      
      apartments.push(apartment);
      stats.validRows++;
      stats.floors.add(apartment.floor);
      if (apartment.unitType) {
        stats.unitTypes.add(apartment.unitType);
      }
    } catch (err) {
      errors.push({
        row: rowNum,
        message: err.message,
        data: row
      });
    }
  }
  
  return {
    apartments,
    errors,
    stats: {
      ...stats,
      floors: Array.from(stats.floors).sort((a, b) => a - b),
      unitTypes: Array.from(stats.unitTypes)
    },
    sheetName,
    columns: Object.keys(rawData[0] || {})
  };
}

/**
 * Map a raw Excel row to apartment data structure
 */
function mapRowToApartment(row, rowNum) {
  const getValue = (key) => {
    const value = row[key];
    if (value === null || value === undefined || value === '') return null;
    return value;
  };
  
  const floor = getValue('Level (floorplate)');
  const plotNumber = getValue('Plot Number');
  const name = getValue('Apartment');
  
  if (!floor || !plotNumber) {
    return null;
  }
  
  const floorNum = parseInt(floor, 10);
  const plotNum = parseInt(plotNumber, 10);
  
  if (isNaN(floorNum) || isNaN(plotNum)) {
    return null;
  }
  
  const hubspotId = getValue('Record ID Hubspot');
  const unitType = getValue('Unit Type');
  const unitPosition = getValue('Unit No.');
  
  const lightIds = [];
  const lightId1 = getValue("Lighting ID's NO.1");
  const lightId2 = getValue("Lighting ID's NO.2");
  const lightId3 = getValue("Lighting ID's NO.3");
  
  if (lightId1 !== null && !isNaN(parseInt(lightId1, 10))) {
    lightIds.push(parseInt(lightId1, 10));
  }
  if (lightId2 !== null && !isNaN(parseInt(lightId2, 10))) {
    lightIds.push(parseInt(lightId2, 10));
  }
  if (lightId3 !== null && !isNaN(parseInt(lightId3, 10))) {
    lightIds.push(parseInt(lightId3, 10));
  }
  
  const id = `RPT-${plotNum}`;
  
  return {
    id,
    name: name || `River Park Tower - ${plotNum}`,
    floor: floorNum,
    plotNumber: plotNum,
    hubspotId: hubspotId ? String(hubspotId) : null,
    unitType: unitType || null,
    unitPosition: unitPosition ? parseInt(unitPosition, 10) : null,
    unitNumber: unitPosition ? String(unitPosition) : null,
    towerId: 'RPT',
    floorplateId: `RPT-L${floorNum}`,
    lightIds,
    lightswarmAddress: lightIds.length > 0 ? lightIds[0] : null,
    currentState: 'AVAILABLE',
    rowNumber: rowNum
  };
}

/**
 * Import apartments into database
 * @param {Object} database - Database module
 * @param {Array} apartments - Parsed apartment data
 * @param {Object} options - Import options
 */
async function importToDatabase(database, apartments, options = {}) {
  const { clearExisting = false, createFloorplates = true, createTower = true } = options;
  
  const results = {
    imported: 0,
    updated: 0,
    skipped: 0,
    floorplatesCreated: 0,
    lightsAssigned: 0,
    errors: []
  };
  
  if (clearExisting) {
    database.apartments.deleteAll();
    results.cleared = true;
  }
  
  if (createTower) {
    const existingTower = database.towers.get('RPT');
    if (!existingTower) {
      const floors = [...new Set(apartments.map(a => a.floor))];
      const maxFloor = Math.max(...floors);
      database.towers.create('RPT', 'River Park Tower', maxFloor);
      results.towerCreated = true;
    }
  }
  
  if (createFloorplates) {
    const floors = [...new Set(apartments.map(a => a.floor))].sort((a, b) => a - b);
    for (const floor of floors) {
      const floorplateId = `RPT-L${floor}`;
      const existing = database.floorplates.get(floorplateId);
      if (!existing) {
        database.floorplates.create(floorplateId, `Level ${floor}`, 'RPT', floor, null);
        results.floorplatesCreated++;
      }
    }
  }
  
  for (const apt of apartments) {
    try {
      const existing = database.apartments.get(apt.id);
      
      if (existing) {
        database.apartments.update(apt.id, {
          name: apt.name,
          floor: apt.floor,
          plotNumber: apt.plotNumber,
          hubspotId: apt.hubspotId,
          unitType: apt.unitType,
          unitPosition: apt.unitPosition,
          unitNumber: apt.unitNumber,
          floorplateId: apt.floorplateId,
          lightswarmAddress: apt.lightswarmAddress
        });
        results.updated++;
      } else {
        database.apartments.create(apt);
        results.imported++;
      }
      
      if (apt.lightIds && apt.lightIds.length > 0) {
        database.apartmentLights.setLights(apt.id, apt.lightIds);
        results.lightsAssigned += apt.lightIds.length;
      }
    } catch (err) {
      results.errors.push({
        apartmentId: apt.id,
        message: err.message
      });
    }
  }
  
  return results;
}

/**
 * Export apartments to Excel format
 * @param {Object} database - Database module
 * @returns {Buffer} Excel file buffer
 */
function exportToExcel(database) {
  const apartments = database.apartments.getAll();
  const allLights = database.apartmentLights.getAll();
  
  const lightsByApartment = {};
  for (const light of allLights) {
    if (!lightsByApartment[light.apartment_id]) {
      lightsByApartment[light.apartment_id] = [];
    }
    lightsByApartment[light.apartment_id].push(light);
  }
  
  const exportData = apartments.map(apt => {
    const lights = lightsByApartment[apt.id] || [];
    lights.sort((a, b) => a.light_index - b.light_index);
    
    return {
      'Record ID Hubspot': apt.hubspot_id || '',
      'Apartment': apt.name,
      'Plot Number': apt.plot_number,
      'Level (floorplate)': apt.floor,
      'Unit Type': apt.unit_type || '',
      'Unit No.': apt.unit_position || '',
      "Lighting ID's NO.1": lights[0]?.lightswarm_address || '',
      "Lighting ID's NO.2": lights[1]?.lightswarm_address || '',
      "Lighting ID's NO.3": lights[2]?.lightswarm_address || '',
      'Current State': apt.current_state
    };
  });
  
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Apartments');
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Validate Excel file before import
 * @param {string|Buffer} filePathOrBuffer - Path to Excel file or buffer
 * @returns {Object} Validation results
 */
function validateExcelFile(filePathOrBuffer) {
  try {
    const parsed = parseExcelFile(filePathOrBuffer);
    
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      summary: {
        totalApartments: parsed.apartments.length,
        floors: parsed.stats.floors,
        unitTypes: parsed.stats.unitTypes,
        apartmentsWithLights: parsed.apartments.filter(a => a.lightIds.length > 0).length,
        apartmentsWithoutLights: parsed.apartments.filter(a => a.lightIds.length === 0).length
      }
    };
    
    if (parsed.apartments.length === 0) {
      validation.valid = false;
      validation.errors.push('No valid apartments found in file');
    }
    
    if (parsed.errors.length > 0) {
      validation.warnings.push(`${parsed.errors.length} rows could not be parsed`);
      validation.parseErrors = parsed.errors;
    }
    
    const duplicatePlots = findDuplicates(parsed.apartments.map(a => a.plotNumber));
    if (duplicatePlots.length > 0) {
      validation.warnings.push(`Duplicate plot numbers found: ${duplicatePlots.join(', ')}`);
    }
    
    return validation;
  } catch (err) {
    return {
      valid: false,
      errors: [`Failed to parse file: ${err.message}`],
      warnings: [],
      summary: null
    };
  }
}

function findDuplicates(arr) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    }
    seen.add(item);
  }
  return Array.from(duplicates);
}

module.exports = {
  parseExcelFile,
  importToDatabase,
  exportToExcel,
  validateExcelFile,
  COLUMN_MAPPINGS
};
