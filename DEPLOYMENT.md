# Raspberry Pi Deployment Guide

Complete setup instructions for deploying the LightSwarm Middleware on a Raspberry Pi.

## Hardware Requirements

- **Raspberry Pi 4** (4GB RAM recommended, 2GB minimum)
- **32GB+ microSD card** (Class 10 or better)
- **Power supply** (Official 5V 3A USB-C)
- **Ethernet cable** (for reliable network connection)
- **USB cable** to LightSwarm LS-USB-IF interface

## Initial Raspberry Pi Setup

### 1. Install Raspberry Pi OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Select "Raspberry Pi OS Lite (64-bit)" - no desktop needed
3. Click gear icon for advanced options:
   - Set hostname: `lightswarm-middleware`
   - Enable SSH with password authentication
   - Set username: `pi` (or your preference)
   - Set password
   - Configure WiFi (optional, Ethernet preferred)
   - Set locale/timezone
4. Flash to microSD card

### 2. First Boot Configuration

```bash
# Connect via SSH
ssh pi@lightswarm-middleware.local
# or use IP address: ssh pi@192.168.x.x

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### 3. Configure Serial Port

```bash
# Add user to dialout group for serial access
sudo usermod -a -G dialout $USER

# Disable serial console (if using GPIO pins)
sudo raspi-config
# Navigate to: Interface Options > Serial Port
# Login shell over serial: No
# Serial port hardware: Yes

# Reboot to apply changes
sudo reboot
```

## Middleware Installation

### 1. Copy Files to Raspberry Pi

From your development machine:

```bash
# Using rsync (recommended)
rsync -avz --exclude 'node_modules' --exclude 'data/*.db' \
  middleware/ pi@lightswarm-middleware.local:~/middleware/

# Or using SCP
scp -r middleware pi@lightswarm-middleware.local:~/
```

### 2. Install Dependencies

```bash
# SSH into Raspberry Pi
ssh pi@lightswarm-middleware.local

# Navigate to middleware folder
cd ~/middleware

# Install production dependencies
npm install --production

# Initialize database
npm run db:init
```

### 3. Configure Settings

```bash
# Edit settings as needed
nano data/middleware.db  # Or use API

# Or configure via API after starting
curl -X PUT http://localhost:3000/api/v1/admin/settings \
  -H "Content-Type: application/json" \
  -d '{
    "com_port": "/dev/ttyUSB0",
    "baud_rate": "38400",
    "simulation_mode": "false"
  }'
```

### 4. Test Run

```bash
# Start the server
npm start

# In another terminal, test the API
curl http://localhost:3000/api/v1/status
```

## Production Setup with PM2

### 1. Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2
```

### 2. Create PM2 Configuration

The `ecosystem.config.js` file is included:

```javascript
module.exports = {
  apps: [{
    name: 'lightswarm-middleware',
    script: 'src/index.js',
    cwd: '/home/pi/middleware',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### 3. Start with PM2

```bash
cd ~/middleware

# Start the application
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs lightswarm-middleware

# Monitor resources
pm2 monit
```

### 4. Enable Auto-Start on Boot

```bash
# Generate startup script
pm2 startup

# Follow the command it outputs (copy and run)
# Example: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u pi --hp /home/pi

# Save current process list
pm2 save
```

## Network Configuration

### Static IP Address

Edit `/etc/dhcpcd.conf`:

```bash
sudo nano /etc/dhcpcd.conf
```

Add at the end:

```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

Restart networking:

```bash
sudo systemctl restart dhcpcd
```

### Firewall (Optional)

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH
sudo ufw allow ssh

# Allow middleware port (from internal network only)
sudo ufw allow from 192.168.1.0/24 to any port 3000

# Enable firewall
sudo ufw enable
```

## USB Port Configuration

### Identify LightSwarm Device

```bash
# List USB devices
lsusb

# Check serial ports
ls -la /dev/ttyUSB*
ls -la /dev/ttyACM*

# Monitor USB events
dmesg | grep -i usb
```

### Create Persistent USB Name (Optional)

Create udev rule for consistent device naming:

```bash
# Find device attributes
udevadm info -a -n /dev/ttyUSB0 | grep -E 'idVendor|idProduct|serial'

# Create rule
sudo nano /etc/udev/rules.d/99-lightswarm.rules
```

Add:

```
SUBSYSTEM=="tty", ATTRS{idVendor}=="XXXX", ATTRS{idProduct}=="XXXX", SYMLINK+="lightswarm"
```

Reload rules:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Now use `/dev/lightswarm` as the port name.

## Monitoring and Maintenance

### View Logs

```bash
# PM2 logs
pm2 logs lightswarm-middleware

# Follow logs in real-time
pm2 logs lightswarm-middleware --lines 100

# System logs
journalctl -u pm2-pi -f
```

### Check Status

```bash
# PM2 status
pm2 status

# API health check
curl http://localhost:3000/api/v1/health

# Full status
curl http://localhost:3000/api/v1/status
```

### Restart Service

```bash
# Restart middleware
pm2 restart lightswarm-middleware

# Reload (zero-downtime)
pm2 reload lightswarm-middleware
```

### Update Middleware

```bash
# Stop service
pm2 stop lightswarm-middleware

# Backup database
cp ~/middleware/data/middleware.db ~/middleware/data/middleware.db.backup

# Update files (from dev machine)
rsync -avz --exclude 'node_modules' --exclude 'data/*.db' \
  middleware/ pi@lightswarm-middleware.local:~/middleware/

# Install any new dependencies
cd ~/middleware && npm install --production

# Restart service
pm2 restart lightswarm-middleware
```

## Troubleshooting

### Serial Connection Issues

```bash
# Check port exists
ls -la /dev/ttyUSB*

# Check permissions
groups $USER  # Should include 'dialout'

# Test serial communication
screen /dev/ttyUSB0 38400

# Check dmesg for errors
dmesg | tail -50
```

### Memory Issues

```bash
# Check memory usage
free -h

# PM2 memory usage
pm2 monit

# Increase swap if needed
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile  # Set CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### Network Issues

```bash
# Check IP address
ip addr show eth0

# Test connectivity
ping -c 4 google.com

# Check if port is listening
netstat -tlnp | grep 3000
ss -tlnp | grep 3000
```

### Database Issues

```bash
# Check database file
ls -la ~/middleware/data/

# Reset database (caution: loses all data)
rm ~/middleware/data/middleware.db
npm run db:init
```

## Backup and Recovery

### Automated Backup Script

Create `/home/pi/backup-middleware.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/home/pi/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp ~/middleware/data/middleware.db "$BACKUP_DIR/middleware_$DATE.db"

# Keep only last 7 days
find $BACKUP_DIR -name "middleware_*.db" -mtime +7 -delete
```

Add to crontab:

```bash
crontab -e
# Add line:
0 2 * * * /home/pi/backup-middleware.sh
```

### Restore from Backup

```bash
pm2 stop lightswarm-middleware
cp ~/backups/middleware_YYYYMMDD_HHMMSS.db ~/middleware/data/middleware.db
pm2 restart lightswarm-middleware
```

## Security Recommendations

1. **Change default credentials** - Use strong passwords
2. **Disable password SSH** - Use key-based authentication
3. **Keep system updated** - Regular `apt update && apt upgrade`
4. **Use firewall** - Limit access to port 3000
5. **Network segmentation** - Keep on isolated VLAN if possible
6. **Regular backups** - Automated database backups
