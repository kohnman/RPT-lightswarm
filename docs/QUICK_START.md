# LightSwarm Quick Start Guide

Get the River Park Towers lighting system running in under 5 minutes.

---

## What You Need

| Item | Description |
|------|-------------|
| Computer | Mac, Windows, or Raspberry Pi with Node.js 18+ installed |
| Network | Ethernet or WiFi connection (for accessing the dashboard) |
| LightSwarm Hardware | USB-connected LightSwarm controller (optional for testing) |

> **No hardware?** No problem! The system runs in **Simulation Mode** automatically when no hardware is detected.

---

## Step 1: Start the System

Open Terminal and run these commands:

```bash
cd middleware
npm install          # First time only
npm start
```

You should see:

```
RiverPark LightSwarm Middleware v1.0.0
==================================================
Middleware initialized successfully!
API Documentation: http://localhost:3000/api/docs
Admin Dashboard: http://localhost:3000/
==================================================
```

> **Tip:** If you see "Simulation mode enabled", that's normal when no LightSwarm hardware is connected.

---

## Step 2: Open the Dashboard

Open your web browser and go to:

**http://localhost:3000**

You'll see the Admin Dashboard with:
- **Green indicator** = System ready
- **"Simulation" badge** = Running without hardware (normal for testing)

---

## Step 3: Run Your First Test

### Quick Test (No Setup Required)

1. Click the **Test Console** tab
2. In the "Address" field, enter: `1`
3. Select command: **Set RGB**
4. Set colors: Red=255, Green=0, Blue=0
5. Click **Send Command**

**Expected result:** You'll see the packet hex code appear below the button. In simulation mode, the command is logged but no physical light changes.

### Broadcast Test (All Lights)

1. In the Test Console tab, find **Broadcast Commands**
2. Click **All ON**
3. Click **All OFF**

**Expected result:** Commands are sent to address 0 (broadcast). All connected lights would turn on/off.

---

## Step 4: Import Apartment Data (Optional)

If you have the apartment Excel file:

1. Click the **Import** tab
2. Drag and drop the Excel file (`.xlsx`)
3. Click **Preview** to verify the data
4. Click **Import** to load apartments

---

## Something Wrong?

### "Cannot connect to localhost:3000"
- Make sure the server is running (check terminal for errors)
- Try: `pkill -f "node src/index.js"` then `npm start`

### "Port 3000 already in use"
```bash
lsof -i :3000           # Find what's using the port
kill -9 <PID>           # Kill that process
npm start               # Try again
```

### "Serial port error"
- This is normal if no LightSwarm hardware is connected
- The system automatically switches to simulation mode

### Dashboard shows blue/blank screen
- Open browser developer tools (F12)
- Check Console tab for JavaScript errors
- Try a hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

---

## Next Steps

| Task | Guide |
|------|-------|
| Set up for production | [COMMISSIONING_GUIDE.md](COMMISSIONING_GUIDE.md) |
| Integrate with Herescope | [HERESCOPE_INTEGRATION.md](HERESCOPE_INTEGRATION.md) |
| Run full system tests | [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) |

---

## Quick Reference

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Admin Dashboard |
| http://localhost:3000/api/docs | API Documentation |
| http://localhost:3000/api/v1/health | Health Check |
| http://localhost:3000/api/v1/status | System Status |

| Command | What It Does |
|---------|--------------|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-reload (development) |
| `Ctrl+C` | Stop the server |
