/**
 * Database Initialization Script
 * Run with: npm run db:init
 */

const database = require('./database');

async function main() {
  console.log('Initializing database...');

  try {
    await database.initialize();
    console.log('Database initialized successfully!');
    console.log('Default settings and state colors have been created.');
    
    const settings = database.settings.getAll();
    console.log(`\nCurrent settings (${settings.length}):`);
    settings.forEach(s => {
      console.log(`  ${s.key}: ${s.value}`);
    });
    
    const colors = database.stateColors.getAll();
    console.log(`\nState colors (${colors.length}):`);
    colors.forEach(c => {
      console.log(`  ${c.state_name}: RGB(${c.red}, ${c.green}, ${c.blue})`);
    });
    
    database.close();
    console.log('\nDatabase ready for use.');
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  }
}

main();
