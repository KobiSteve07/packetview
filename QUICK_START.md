# Quick Start Guide

## Installation

```bash
# Install all dependencies
npm run install:all

# Or install individually
npm install
cd backend && npm install
cd ../frontend && npm install
```

## Running the Application

### Development Mode

**Option 1: Run both backend and frontend simultaneously**
```bash
npm run dev
```

**Option 2: Run separately**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Production Mode

Build and run:
```bash
# Build backend
cd backend
npm run build
npm start

# Build frontend
cd frontend
npm run build
npm run preview
```

## Using PacketView

1. **Start the application** - Backend on port 3001, frontend on port 5173 (default)

2. **Open browser** - Navigate to `http://localhost:5173`

3. **Select Interface** - Choose a network interface from the dropdown
   - Only active interfaces (↑) can be selected
   - Common interfaces: wlan0, eth0, en0, etc.

4. **Optional: Add BPF Filter** - Apply tcpdump-style filters
   - Examples:
     - `port 80` - HTTP traffic only
     - `host 192.168.1.1` - Traffic to/from specific host
     - `tcp port 443` - HTTPS traffic only
     - `port 53 or port 80` - Multiple ports

5. **Start Capture** - Click "Start Capture" button
   - **Note**: Requires root/sudo privileges for packet capture
   - Run backend with sudo if you get permission errors

6. **View Visualization**
   - **Devices**: Blue circles representing network hosts
   - **Size**: Larger circles = more traffic
   - **Connections**: Lines between devices
   - **Colors**: Different colors for different protocols
   - **Hover**: See detailed information about each device

7. **Monitor Statistics**
   - Total packets captured
   - Total traffic volume
   - Active devices count
   - Active connections count

8. **Stop Capture** - Click "Stop Capture" when done

## Troubleshooting

### Permission Denied
If you see permission errors when starting capture:
```bash
# Run backend with sudo
sudo npm run dev

# Or set capabilities (recommended)
sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)
```

### No Interfaces Showing
- Check that tcpdump is installed: `which tcpdump`
- Verify permissions: `sudo tcpdump -D`
- Check if interfaces are up: `ip addr show`

### Frontend Not Connecting
- Ensure backend is running on port 3001
- Check browser console for WebSocket errors
- Verify firewall isn't blocking connection

### High CPU Usage
- Add BPF filters to reduce captured traffic
- Monitor specific ports instead of all traffic
- Consider capturing on specific interface only

## Advanced Features

### Protocol Color Codes
- **TCP**: Blue
- **UDP**: Green
- **ICMP**: Red
- **HTTP**: Orange
- **HTTPS**: Mint Green
- **DNS**: Pink
- **SSH**: Purple
- **FTP**: Blue
- **SMTP**: Orange
- **Other**: Gray

### BPF Filter Examples
```
# HTTP only
port 80

# HTTPS only
port 443

# Specific host
host 192.168.1.100

# Specific subnet
net 192.168.1.0/24

# Exclude traffic
not port 22

# Multiple conditions
tcp and port 80

# Complex filter
(tcp port 80 or tcp port 443) and not host 192.168.1.1
```

## Project Structure

```
packetview/
├── backend/           # Node.js backend
│   ├── src/
│   │   ├── index.ts              # Main entry point
│   │   ├── services/
│   │   │   ├── PacketCaptureService.ts    # tcpdump integration
│   │   │   └── NetworkAnalysisService.ts   # Traffic analysis
│   │   └── shared/
│   │       └── types/
│   └── package.json
├── frontend/          # Vite + TypeScript frontend
│   ├── src/
│   │   ├── main.ts              # Application entry
│   │   ├── services/
│   │   │   ├── api.ts          # WebSocket & API client
│   │   │   └── visualization.ts # Canvas rendering
│   │   └── styles/
│   │       └── global.css       # Styles
│   ├── index.html
│   └── package.json
└── shared/            # Shared TypeScript types
    └── types/
        └── index.ts
```

## API Endpoints

### GET /api/interfaces
Returns available network interfaces

### POST /api/capture/start
Starts packet capture on specified interface

Request body:
```json
{
  "interface": "wlan0",
  "filter": "port 80"
}
```

### POST /api/capture/stop
Stops current packet capture

### GET /api/capture/status
Returns capture status

Response:
```json
{
  "capturing": true
}
```

## WebSocket Events

### Connection
`ws://localhost:3001/ws`

### Messages

**INTERFACE_LIST**
- List of available network interfaces

**PACKET**
- Real-time packet data

**NETWORK_STATE**
- Current network topology state

**ERROR**
- Error messages

## Security Notes

- Packet capture requires elevated privileges
- BPF filters can limit exposure to sensitive data
- Consider running backend as non-root with capabilities set
- WebSocket connections are not encrypted (use HTTPS/WSS in production)
