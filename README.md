# River Park Towers LightSwarm Middleware

Middleware system for controlling the LightSwarm architectural model lighting system from the Herescope Unreal Engine application.

## Documentation

Visit the [Documentation Center](/docs/) or access these guides directly:

| Guide | Description |
|-------|-------------|
| [Quick Start](docs/quick-start.html) | Get running in 5 minutes |
| [Herescope Integration](docs/herescope.html) | API guide for Herescope developers |
| [Commissioning Guide](docs/commissioning.html) | Full setup and configuration walkthrough |
| [Testing Checklist](docs/testing.html) | Printable system test procedures |

Access the **Help** tab in the Admin Dashboard for interactive guidance.

### Operation Modes

- **Live Mode**: Connects to real LightSwarm hardware via USB (for production)
- **Simulator Mode**: Software simulation without hardware (for development/testing)

## Overview

This middleware runs on a Raspberry Pi and provides:
- REST API for Herescope integration
- MDP protocol implementation for LightSwarm communication
- Web-based admin dashboard
- Simulation mode for remote testing
- Ambient animation engine

## System Architecture

```
┌─────────────────────┐      HTTP/REST      ┌─────────────────────┐      USB/Serial      ┌─────────────────────┐
│  Herescope App      │ ──────────────────► │  Raspberry Pi       │ ─────────────────► │  LightSwarm         │
│  (Windows 11)       │                     │  Middleware         │                     │  Controller         │
└─────────────────────┘                     └─────────────────────┘                     └─────────────────────┘
                                                     │
                                                     │ WebSocket
                                                     ▼
                                            ┌─────────────────────┐
                                            │  Admin Dashboard    │
                                            │  (Web Browser)      │
                                            └─────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- Raspberry Pi 4 (4GB+ RAM) or compatible Linux system
- USB connection to LightSwarm LS-USB-IF interface

### Installation

```bash
# Clone or copy middleware folder to Raspberry Pi
cd middleware

# Install dependencies
npm install

# Initialize database (creates default settings)
npm run db:init

# Start the server
npm start
```

### Access Points

- **Admin Dashboard**: http://raspberry-pi-ip:3000/
- **API Documentation**: http://raspberry-pi-ip:3000/api/docs
- **API Base URL**: http://raspberry-pi-ip:3000/api/v1/

## Configuration

### Serial Connection

Edit settings via the admin dashboard or API:

```bash
# Via API
curl -X PUT http://localhost:3000/api/v1/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"com_port": "/dev/ttyUSB0", "baud_rate": "38400"}'
```

### State Colors

Default state colors can be customized:

| State | Default Color | RGB |
|-------|---------------|-----|
| SOLD | Red | 255, 0, 0 |
| AVAILABLE | Green | 0, 255, 0 |
| UNAVAILABLE | Orange | 180, 80, 0 |
| SELECTED | White | 255, 255, 255 |
| RESERVED | Yellow | 255, 255, 0 |

### Simulation Mode

Enable simulation mode for testing without hardware:

```bash
curl -X PUT http://localhost:3000/api/v1/admin/serial/simulation \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

## API Usage

### Session Management

```bash
# Agent login (stops ambient, fades down top to bottom)
curl -X POST http://localhost:3000/api/v1/session/login \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-001"}'

# Agent logout (starts ambient animation)
curl -X POST http://localhost:3000/api/v1/session/logout \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-001"}'
```

### Lighting Control

```bash
# Light single apartment
curl -X PUT http://localhost:3000/api/v1/apartments/T1-L23-01 \
  -H "Content-Type: application/json" \
  -d '{"state": "AVAILABLE", "fadeTime": 500}'

# Light multiple apartments
curl -X PUT http://localhost:3000/api/v1/apartments/batch \
  -H "Content-Type: application/json" \
  -d '{"apartments": ["T1-L23-01", "T1-L23-02"], "state": "SOLD"}'

# Light floorplate
curl -X PUT http://localhost:3000/api/v1/floorplates/FP-T1-L23 \
  -H "Content-Type: application/json" \
  -d '{"state": "SELECTED"}'

# Light amenity
curl -X PUT http://localhost:3000/api/v1/amenities/gym-01 \
  -H "Content-Type: application/json" \
  -d '{"state": "SELECTED"}'

# All off
curl -X POST http://localhost:3000/api/v1/apartments/all/off
```

## Data Import

### Apartment Mapping

Import apartment-to-address mappings via API:

```bash
curl -X POST http://localhost:3000/api/v1/admin/apartments/import \
  -H "Content-Type: application/json" \
  -d '{
    "clearExisting": false,
    "apartments": [
      {
        "id": "T1-L23-01",
        "name": "Unit 2301",
        "lightswarmAddress": 1000,
        "towerId": "T1",
        "floor": 23,
        "floorplateId": "FP-T1-L23",
        "unitNumber": "01"
      }
    ]
  }'
```

## Development

### Project Structure

```
middleware/
├── src/
│   ├── api/           # REST API routes
│   ├── mdp/           # MDP protocol implementation
│   ├── config/        # Database and settings
│   ├── animation/     # Ambient animation engine
│   └── simulator/     # Virtual light simulator
├── public/            # Admin dashboard
├── data/              # SQLite database
└── tests/             # Test files
```

### Running in Development

```bash
npm run dev  # Uses nodemon for auto-reload
```

### Running Tests

```bash
npm test
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed Raspberry Pi setup instructions.

### Quick Deploy with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Enable startup on boot
pm2 startup
pm2 save
```

## Troubleshooting

### Serial Port Issues

1. Check port permissions: `sudo chmod 666 /dev/ttyUSB0`
2. Add user to dialout group: `sudo usermod -a -G dialout $USER`
3. Verify port: `ls -la /dev/ttyUSB*`

### Connection Problems

1. Check serial status: `GET /api/v1/admin/serial/status`
2. List available ports: `GET /api/v1/admin/serial/ports`
3. Try reconnecting: `POST /api/v1/admin/serial/reconnect`

### Enable Simulation Mode

If hardware is unavailable:
```bash
curl -X PUT http://localhost:3000/api/v1/admin/serial/simulation \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

## License

Proprietary - Hooper / River Park Towers

## Support

Contact: dan@hooper.com
