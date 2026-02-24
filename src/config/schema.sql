-- River Park Towers LightSwarm Middleware Database Schema

-- System settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- State color definitions
CREATE TABLE IF NOT EXISTS state_colors (
    state_name TEXT PRIMARY KEY,
    red INTEGER NOT NULL CHECK(red >= 0 AND red <= 255),
    green INTEGER NOT NULL CHECK(green >= 0 AND green <= 255),
    blue INTEGER NOT NULL CHECK(blue >= 0 AND blue <= 255),
    intensity INTEGER NOT NULL DEFAULT 255 CHECK(intensity >= 0 AND intensity <= 255),
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Towers
CREATE TABLE IF NOT EXISTS towers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    total_floors INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Floorplates (groups of apartments on a floor)
CREATE TABLE IF NOT EXISTS floorplates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tower_id TEXT NOT NULL,
    floor INTEGER NOT NULL,
    pseudo_address INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tower_id) REFERENCES towers(id)
);

-- Apartments
CREATE TABLE IF NOT EXISTS apartments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lightswarm_address INTEGER,
    tower_id TEXT NOT NULL,
    floor INTEGER NOT NULL,
    floorplate_id TEXT,
    unit_number TEXT,
    current_state TEXT DEFAULT 'AVAILABLE',
    hubspot_id TEXT,
    plot_number INTEGER,
    unit_type TEXT,
    unit_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tower_id) REFERENCES towers(id),
    FOREIGN KEY (floorplate_id) REFERENCES floorplates(id),
    FOREIGN KEY (current_state) REFERENCES state_colors(state_name)
);

-- Multiple lighting IDs per apartment
CREATE TABLE IF NOT EXISTS apartment_lights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apartment_id TEXT NOT NULL,
    light_index INTEGER NOT NULL,
    lightswarm_address INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    UNIQUE(apartment_id, light_index)
);

-- Amenities
CREATE TABLE IF NOT EXISTS amenities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lightswarm_address INTEGER NOT NULL,
    tower_id TEXT,
    floor INTEGER,
    amenity_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tower_id) REFERENCES towers(id)
);

-- Animation sequences
CREATE TABLE IF NOT EXISTS animation_sequences (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sequence_data TEXT NOT NULL,
    is_ambient_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Command log
CREATE TABLE IF NOT EXISTS command_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL,
    command_type TEXT NOT NULL,
    target_id TEXT,
    target_address INTEGER,
    request_data TEXT,
    response_data TEXT,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    execution_time_ms INTEGER
);

-- Session log
CREATE TABLE IF NOT EXISTS session_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,
    agent_id TEXT,
    details TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_apartments_tower ON apartments(tower_id);
CREATE INDEX IF NOT EXISTS idx_apartments_floor ON apartments(floor);
CREATE INDEX IF NOT EXISTS idx_apartments_floorplate ON apartments(floorplate_id);
CREATE INDEX IF NOT EXISTS idx_apartments_address ON apartments(lightswarm_address);
CREATE INDEX IF NOT EXISTS idx_amenities_tower ON amenities(tower_id);
CREATE INDEX IF NOT EXISTS idx_amenities_floor ON amenities(floor);
CREATE INDEX IF NOT EXISTS idx_command_log_timestamp ON command_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_command_log_source ON command_log(source);
CREATE INDEX IF NOT EXISTS idx_session_log_timestamp ON session_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_apartment_lights_apartment ON apartment_lights(apartment_id);
CREATE INDEX IF NOT EXISTS idx_apartment_lights_address ON apartment_lights(lightswarm_address);
CREATE INDEX IF NOT EXISTS idx_apartments_plot ON apartments(plot_number);
CREATE INDEX IF NOT EXISTS idx_apartments_hubspot ON apartments(hubspot_id);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('com_port', '/dev/ttyUSB0', 'Serial port path for LightSwarm connection'),
    ('baud_rate', '38400', 'Serial baud rate'),
    ('default_fade_time_ms', '500', 'Default fade time in milliseconds'),
    ('default_intensity', '200', 'Default LED intensity (0-255)'),
    ('simulation_mode', 'false', 'Enable simulation mode (no hardware communication)'),
    ('ambient_enabled', 'true', 'Enable ambient animation when idle'),
    ('ambient_sequence_id', 'default_ambient', 'ID of the ambient animation sequence'),
    ('login_fade_delay_ms', '100', 'Delay between floors during login fade-down'),
    ('api_port', '3000', 'REST API server port'),
    ('log_retention_days', '30', 'Days to retain command logs');

-- Insert default state colors
INSERT OR IGNORE INTO state_colors (state_name, red, green, blue, intensity, description) VALUES
    ('SOLD', 255, 0, 0, 200, 'Sold - Red'),
    ('AVAILABLE', 0, 255, 0, 200, 'Available - Green'),
    ('UNAVAILABLE', 180, 80, 0, 200, 'Unavailable - Orange/Brown'),
    ('SELECTED', 255, 255, 255, 255, 'Selected - White'),
    ('RESERVED', 255, 255, 0, 200, 'Reserved - Yellow'),
    ('OFF', 0, 0, 0, 0, 'Off state');

-- Insert default ambient sequence
INSERT OR IGNORE INTO animation_sequences (id, name, description, sequence_data, is_ambient_default) VALUES
    ('default_ambient', 'Default Ambient', 'All lights on at reduced brightness', 
     '{"type":"static","steps":[{"command":"all_on","intensity":100,"color":{"r":255,"g":255,"b":255}}]}', 1);
