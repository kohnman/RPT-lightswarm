# LightSwarm Commissioning Guide

Complete guide for setting up the River Park Towers lighting system from scratch.

---

## Overview

Commissioning involves these main steps:

1. **Hardware Setup** - Connect LightSwarm controller
2. **Software Setup** - Install and start middleware
3. **Import Data** - Load apartment matrix from Excel
4. **Assign Light IDs** - Map apartments to physical lights
5. **Test Everything** - Verify all connections work
6. **Go Live** - Enable for Herescope integration

---

## Part 1: Hardware Setup

### Equipment Checklist

| Item | Quantity | Notes |
|------|----------|-------|
| Raspberry Pi 4 (or Mac for testing) | 1 | 4GB+ RAM recommended |
| LightSwarm LS-USB-IF controller | 1 | USB interface module |
| USB-A to USB-B cable | 1 | For LightSwarm connection |
| Ethernet cable | 1 | Connect to network |
| Power supply | 1 | For Raspberry Pi |
| microSD card | 1 | 32GB+, with Raspberry Pi OS |

### Connection Diagram

```
┌─────────────────┐     USB      ┌─────────────────┐
│                 │◄────────────►│                 │
│  Raspberry Pi   │              │   LightSwarm    │
│   (Middleware)  │              │   Controller    │
│                 │              │                 │
└────────┬────────┘              └────────┬────────┘
         │                                │
    Ethernet                         12V Power
         │                                │
         ▼                                ▼
┌─────────────────┐              ┌─────────────────┐
│  Network Switch │              │   LED Strips    │
│  (to Herescope) │              │   on Model      │
└─────────────────┘              └─────────────────┘
```

### Physical Setup Steps

1. **Connect LightSwarm to Raspberry Pi**
   - Plug USB cable from LightSwarm into Raspberry Pi USB port
   - Power on LightSwarm controller
   - LED indicator on LightSwarm should illuminate

2. **Connect Raspberry Pi to Network**
   - Plug Ethernet cable into Raspberry Pi
   - Connect other end to network switch
   - Ensure same network as Herescope server

3. **Power On Raspberry Pi**
   - Insert microSD card with Raspberry Pi OS
   - Connect power supply
   - Wait for boot (1-2 minutes)

---

## Part 2: Software Setup

### First Time Installation

SSH into Raspberry Pi or open terminal:

```bash
# Clone or copy the middleware folder
cd /home/pi
# (copy middleware folder here)

# Install dependencies
cd middleware
npm install

# Verify installation
npm start
```

### Verify Hardware Detection

When you start the middleware, look for:

```
[2/5] Initializing serial connection...
      Port: /dev/ttyUSB0, Baud: 38400
      Serial connection established  ← Good! Hardware detected
```

If you see "Running in simulation mode", the USB isn't detected:

```bash
# List USB devices
ls -la /dev/ttyUSB*

# Check USB connection
lsusb
```

### Configure Serial Port (if needed)

1. Open dashboard: http://RASPBERRY_PI_IP:3000
2. Go to **Settings** tab
3. Set **COM Port** to `/dev/ttyUSB0` (or detected port)
4. Set **Baud Rate** to `38400`
5. Turn **Simulation Mode** OFF
6. Click **Save Settings**
7. Restart middleware: `Ctrl+C` then `npm start`

---

## Part 3: Import Apartment Data

### Prepare the Excel File

The Excel file should have these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Record ID Hubspot | External reference | `abc123` |
| Apartment | Full name | `River Park Tower - 909` |
| Plot Number | Unique plot ID | `909` |
| Level (floorplate) | Floor number | `9` |
| Unit Type | Apartment type | `2-Bed` |
| Unit No. | Position on floor | `1` |
| Lighting ID's NO.1 | First light address | `1001` |
| Lighting ID's NO.2 | Second light address | `1002` |
| Lighting ID's NO.3 | Third light address | (optional) |

### Import Process

1. **Open Dashboard**
   - Go to http://MIDDLEWARE_IP:3000
   - Click **Import** tab

2. **Upload Excel File**
   - Drag and drop the `.xlsx` file
   - Or click "Browse" to select file

3. **Preview Data**
   - Click **Preview** button
   - Verify the data looks correct
   - Check the statistics:
     - Total apartments found
     - Apartments with light IDs
     - Apartments needing assignment

4. **Import Options**
   - ☑️ Check "Clear existing apartments" for fresh import
   - ☐ Uncheck to add/update existing data

5. **Execute Import**
   - Click **Import** button
   - Wait for confirmation
   - Check results:
     - Imported: X apartments
     - Floorplates created: Y

### Verify Import

After import, go to **Dashboard** tab:
- Total apartments should match Excel
- Click **Mapping Editor** tab to see all apartments

---

## Part 4: Assign Light IDs

Light IDs connect apartments to physical lights on the model. Each apartment can have up to 3 lights.

### Using the Mapping Editor

1. **Open Mapping Editor Tab**
   - Shows all apartments in a table
   - Filter by floor using dropdown

2. **For Each Apartment:**
   - Find the apartment row
   - Enter Light ID in columns: NO.1, NO.2, NO.3
   - Light IDs are typically 0-65535

3. **Finding Light IDs:**
   - Physical lights have ID labels
   - Or use Test Console to identify:
     - Enter address, click "Turn On"
     - See which light turns on
     - Note the address

4. **Save Changes**
   - Click **Save Changes** button (top right)
   - Button is disabled when no changes pending

### Bulk Auto-Assignment

If lights are numbered sequentially:

1. In Mapping Editor, find **Bulk Assignment** panel
2. Enter **Start Address** (first light ID)
3. Enter **Increment** (usually 1)
4. Optionally filter by floor
5. Click **Apply Auto-Assign**
6. Review assignments
7. Click **Save Changes**

### Export for Backup

After assigning all IDs:
1. Click **Export Excel** button
2. Save the file as backup
3. This file can be re-imported later

---

## Part 5: Testing

### Test Individual Apartments

1. Go to **Mapping Editor** tab
2. Find an apartment with assigned Light IDs
3. Click **Test** button (rightmost column)
4. Physical light should turn WHITE for 3 seconds
5. Repeat for several apartments across different floors

### Test by Direct Address

1. Go to **Test Console** tab
2. Enter a known Light ID address
3. Select **Set RGB**, set to Red (255,0,0)
4. Click **Send Command**
5. Verify the correct physical light turns red

### Test Floorplates

1. Use curl or API:
   ```bash
   curl -X PUT http://localhost:3000/api/v1/floorplates/Level-9 \
     -H "Content-Type: application/json" \
     -d '{"state": "AVAILABLE"}'
   ```
2. All lights on floor 9 should turn green

### Test Session Flow

```bash
# Login - ambient should stop, lights fade down
curl -X POST http://localhost:3000/api/v1/session/login \
  -H "Content-Type: application/json" \
  -d '{"agentId": "commissioning-test"}'

# Light some apartments
curl -X PUT http://localhost:3000/api/v1/apartments/batch \
  -H "Content-Type: application/json" \
  -d '{"apartmentIds": ["RPT-L09-01", "RPT-L10-01"], "state": "AVAILABLE"}'

# Logout - ambient should start
curl -X POST http://localhost:3000/api/v1/session/logout
```

### Full System Test

See [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) for complete testing procedure.

---

## Part 6: Production Setup

### Enable Auto-Start

On Raspberry Pi, use PM2:

```bash
# Install PM2
npm install -g pm2

# Start middleware with PM2
cd /home/pi/middleware
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Enable startup on boot
pm2 startup
```

### Set Static IP

Edit `/etc/dhcpcd.conf`:

```bash
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

Reboot: `sudo reboot`

### Configure Firewall

```bash
# Allow port 3000
sudo ufw allow 3000/tcp
sudo ufw enable
```

### Disable Simulation Mode

1. Open Dashboard → Settings
2. Turn OFF **Simulation Mode**
3. Click **Save Settings**
4. Verify green "Connected" indicator

---

## Troubleshooting

### "Serial port not found"

```bash
# Check USB devices
ls -la /dev/ttyUSB*

# If not found, check dmesg
dmesg | grep tty

# Add user to dialout group
sudo usermod -a -G dialout $USER
# Log out and back in
```

### "Permission denied on serial port"

```bash
sudo chmod 666 /dev/ttyUSB0
# Or permanently:
sudo usermod -a -G dialout pi
```

### Lights don't respond

1. Check LightSwarm power LED is on
2. Check USB cable connection
3. Verify correct COM port in Settings
4. Verify baud rate is 38400
5. Try simulation mode first to test API

### Import shows 0 apartments

1. Check Excel file format matches expected columns
2. Try re-exporting from source as `.xlsx`
3. Check browser console for errors (F12)

### Dashboard blank/blue screen

1. Clear browser cache
2. Try incognito/private window
3. Check terminal for server errors
4. Restart middleware: `Ctrl+C` then `npm start`

---

## Maintenance

### Daily Checks

- Dashboard shows "Connected" (not Simulation)
- Recent commands log shows activity
- No error messages in terminal

### Weekly Backup

```bash
# Backup database
cp middleware/data/middleware.db middleware/data/middleware.db.backup

# Export apartment mapping
# Use Dashboard → Mapping Editor → Export Excel
```

### Software Updates

```bash
cd middleware
git pull  # If using git
npm install  # Update dependencies
pm2 restart all  # Restart service
```

---

## Quick Reference Card

| Task | Location |
|------|----------|
| Start system | `cd middleware && npm start` |
| Open dashboard | http://IP:3000 |
| Import apartments | Dashboard → Import tab |
| Assign light IDs | Dashboard → Mapping Editor |
| Test single light | Dashboard → Test Console |
| Check status | Dashboard → Dashboard tab |
| Change settings | Dashboard → Settings tab |

| Common IPs | |
|------------|---|
| Raspberry Pi | 192.168.1.100 (set static) |
| Dashboard | http://192.168.1.100:3000 |
| API | http://192.168.1.100:3000/api/v1 |

| Support | |
|---------|---|
| Technical issues | Check [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) |
| API integration | See [HERESCOPE_INTEGRATION.md](HERESCOPE_INTEGRATION.md) |
