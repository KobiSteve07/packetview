# PacketView

Real-time 2D network traffic visualization tool that captures, analyzes, and displays network packets in an interactive web interface.

![License](https://img.shields.io/badge/license-GPL--3.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

**This project is made in large part using OpenCode (and the Oh-My-Opencode plugin), which is an AI tool. You have been warned!**

## Overview

PacketView is a full-stack application that captures network packets using `tcpdump` and visualizes network traffic in real-time. It provides a 2D interactive visualization of devices, connections, and data flows on your network.

## Features

 - **Real-time Packet Capture**: Capture packets from one or multiple network interfaces simultaneously
- **2D Network Visualization**: Interactive visual representation of network topology with devices and connections
- **Live Filtering**: Filter traffic by IP address, protocol (TCP, UDP, ICMP, HTTP, etc.), IP type (local/public), and interface
- **Collapsible Filter Panel**: Collapse the Live Filters section to maximize visualization space
- **Network Analysis**: Automatic device discovery and connection tracking
- **Real-time Statistics**: View total packets, traffic volume, active devices, and active connections
- **WebSocket Communication**: Low-latency real-time updates via WebSocket
- **Multi-interface Support**: Monitor multiple network interfaces at once
- **Broadcast/Multicast Support**: Option to include or exclude broadcast/multicast traffic
- **Responsive Design**: Clean and intuitive web interface
- **Multi-Device Selection**: Select and drag multiple devices simultaneously for easier network layout management
- **Customizable Color Scheme**: Personalize protocol and device colors with an intuitive color manager
- **UI Theme Override**: Choose between system accent color (matches your OS theme) or custom accent colors
- **Collapsible Color Manager**: Organized color settings with collapsible categories for Protocol Colors, Device Colors, and UI Theme
- **Persistent Color Preferences**: Your color settings are saved locally and persist across browser sessions
- **Device Properties Panel**: View detailed statistics for selected devices including total traffic, packets, and device type breakdown
- **Smart Panel Layout**: Device info panel dynamically repositions when color manager is open
- **Smooth Animations**: Fade and slide transitions for all UI panels
- **Reverse DNS Lookup**: Resolve hostnames for visible devices with manual or automatic lookup

## Architecture

```
PacketView/
├── backend/           # Node.js/Express backend with WebSocket
│   ├── src/
│   │   ├── services/  # Packet capture and network analysis
│   │   ├── config/    # Configuration
│   │   └── utils/     # Logging and utilities
│   └── tests/         # Backend tests
├── frontend/          # TypeScript/Vite frontend
│   └── src/
│       ├── services/  # WebSocket and visualization
│       └── styles/    # CSS styling
├── shared/            # Shared TypeScript types
└── Docker files       # Container configuration
```

### Components

- **Backend**: Express.js server with WebSocket support for real-time packet streaming
- **PacketCaptureService**: Manages tcpdump processes for packet capture
- **NetworkAnalysisService**: Analyzes packets to build network state (devices, connections, flows)
- **Frontend**: Vite-powered SPA with HTML5 Canvas for 2D visualization
- **VisualizationService**: Renders network topology and packet animations
- **ColorManager**: Manages color preferences with localStorage persistence
- **DevicePropertiesPanel**: Displays aggregated statistics for selected devices with dynamic positioning


## Prerequisites

### System Requirements

- **Operating System**: Linux (required for tcpdump capabilities)
- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **tcpdump**: Must be installed and have `NET_ADMIN` and `NET_RAW` capabilities
- **libpcap**: Packet capture library

### Install tcpdump

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install tcpdump libpcap-dev
```

**Fedora/RHEL:**
```bash
sudo dnf install tcpdump libpcap-devel
```

**macOS:**
```bash
brew install libpcap
# Note: tcpdump is pre-installed on macOS, but capturing requires root privileges
```

## Installation

### Local Development

1. **Clone the repository:**
   ```bash
   git clone github.com/KobiSteve07/packetview
   cd packetview
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env as needed
   ```

4. **Set tcpdump capabilities** (for non-root execution):
   ```bash
   sudo setcap cap_net_raw,cap_net_admin=eip /usr/bin/tcpdump
   ```

### Docker Deployment

See [Docker Deployment](#docker-deployment) section below.

## Usage

### Development Mode

Run both backend and frontend simultaneously:

```bash
npm run dev
```

This starts:
- Backend on `http://localhost:3001`
- Frontend on `http://localhost:5173` (Vite dev server)
- WebSocket on `ws://localhost:3001/ws`

Access the application at `http://localhost:5173`

### Production Mode

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

The backend will serve the built frontend files and listen on port 3001.

### Using the Interface

1. **Network Interfaces**: Select which interfaces to monitor from the checkbox list
2. **Live Filters**:
   - **IP Address**: Filter by specific IP or subnet (e.g., `192.168`)
   - **IP Type**: Show only local or public IP addresses
   - **Protocol**: Filter by protocol (TCP, UDP, ICMP, HTTP, etc.)
   - **Interface**: Filter by specific network interface
   - **Broadcast/Multicast**: Include or exclude broadcast/multicast packets
3. **Controls**:
   - **Reset View**: Reset the visualization to default state
   - **Enable/Disable Animations**: Toggle packet flow animations
   - **Color Manager**: Open the color customization panel
4. **Color Manager**:
   - **Protocol Colors**: Customize colors for each protocol (TCP, UDP, ICMP, HTTP, HTTPS, DNS, SSH, FTP, SMTP)
   - **Device Colors**: Customize gradient colors for My Device, Local Devices, and Public Devices
   - **Individual Reset**: Reset each protocol to its default color
   - **Reset All**: Restore all colors to their default values
   - **Live Preview**: Changes are immediately reflected in the visualization
   - **Persistent Settings**: Color preferences are saved to localStorage and persist across sessions
5. **Device Selection & Manipulation**:
   - **Click**: Select a single device
   - **Ctrl+Click**: Toggle device selection (add/remove from selection)
   - **Ctrl+Drag**: Draw rectangle to select multiple devices
   - **Drag**: Move selected devices (maintains relative positions)
   - **Click empty space**: Clear selection
   - **Escape**: Deselect all devices
   - **Ctrl+A / Cmd+A**: Select all visible devices
6. **Device Properties Panel**: Automatically appears when devices are selected
   - Shows **number of selected devices**
   - Displays **total traffic** (inbound, outbound, combined)
   - Breakdown of **local vs public** devices
   - **Device type distribution** (Gateway, Host, Router, etc.)
   - List of **individual device IPs** with traffic stats
   - Dynamically repositions when Color Manager is open
   - Smooth fade in/out animations
7. **Reverse DNS Lookup**:
   - **Auto Lookup**: Enable "Auto Reverse DNS" checkbox to automatically resolve hostnames for all visible devices
   - **Manual Lookup**: Select devices and click "Lookup Hostnames" in the Device Properties Panel
   - **Display**: Hostnames appear below IP addresses on device nodes and in the device list
8. **Touchscreen Support**:
   - **Tap**: Select a single device
   - **Long-press (500ms) + Drag**: Draw rectangle to select multiple devices
   - **Drag**: Move selected devices
   - **Tap empty space**: Clear selection
9. **Statistics Panel**: View real-time network statistics

## API Reference

### REST Endpoints

#### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-30T12:00:00.000Z",
  "port": 3001
}
```

#### GET /api/interfaces
List all available network interfaces

**Response:**
```json
{
  "interfaces": [
    {
      "name": "eth0",
      "ip": "192.168.1.100",
      "isUp": true
    }
  ]
}
```

#### POST /api/capture/start
Start packet capture on interface(s)

**Request Body:**
```json
{
  "interface": "eth0",
  "interfaces": ["eth0", "wlan0"],
  "filter": "port 80"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Capture started on 2 interface(s)",
  "interfaces": ["eth0", "wlan0"]
}
```

#### POST /api/capture/stop
Stop packet capture

**Request Body:**
```json
{
  "interface": "eth0"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Capture stopped on eth0"
}
```

#### GET /api/capture/status
Get current capture status

**Response:**
```json
{
  "active": true,
  "interfaces": ["eth0", "wlan0"]
}
```

#### GET /api/capture/interfaces
Get list of active interfaces being monitored

**Response:**
```json
{
  "interfaces": ["eth0", "wlan0"]
}
```

#### POST /api/capture/interfaces
Update which interfaces are being monitored

**Request Body:**
```json
{
  "interfaces": ["eth0"]
}
```

**Response:**
```json
{
  "success": true,
  "interfaces": ["eth0"]
}
```

#### GET /api/reverse-dns/:ip
Perform reverse DNS lookup for a single IP address

**Response:**
```json
{
  "ip": "8.8.8.8",
  "hostname": "dns.google"
}
```

#### POST /api/reverse-dns/batch
Perform reverse DNS lookup for multiple IP addresses (max 100)

**Request Body:**
```json
{
  "ips": ["8.8.8.8", "1.1.1.1"]
}
```

**Response:**
```json
{
  "results": [
    { "ip": "8.8.8.8", "hostname": "dns.google" },
    { "ip": "1.1.1.1", "hostname": "one.one.one.one" }
  ]
}
```

### WebSocket Messages

#### Connection
Connect to `ws://localhost:3001/ws`

#### Message Types

**INTERFACE_LIST**: Sent on connection and when interfaces change
```json
{
  "type": "interface_list",
  "data": [
    {
      "name": "eth0",
      "ip": "192.168.1.100",
      "isUp": true
    }
  ],
  "timestamp": 1706625600000
}
```

**PACKET**: Sent for each captured packet
```json
{
  "type": "packet",
  "data": {
    "sourceIp": "192.168.1.100",
    "destIp": "8.8.8.8",
    "sourcePort": 54321,
    "destPort": 443,
    "protocol": "TCP",
    "size": 1024,
    "timestamp": 1706625600000,
    "interface": "eth0"
  },
  "timestamp": 1706625600000
}
```

**NETWORK_STATE**: Broadcast every 2 seconds when clients are connected
```json
{
  "type": "network_state",
  "data": {
    "devices": [
      {
        "ip": "192.168.1.100",
        "mac": "00:11:22:33:44:55",
        "hostname": "my-laptop",
        "type": "HOST",
        "isLocal": true
      }
    ],
    "connections": [
      {
        "id": "conn-1",
        "sourceIp": "192.168.1.100",
        "destIp": "8.8.8.8",
        "protocol": "TCP",
        "bytes": 524288,
        "packets": 1000
      }
    ],
    "flows": []
  },
  "timestamp": 1706625600000
}
```

**ERROR**: Sent when an error occurs
```json
{
  "type": "error",
  "data": {
    "error": "Failed to start capture: Permission denied"
  },
  "timestamp": 1706625600000
}
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Network Configuration
DISABLE_AUTO_CAPTURE=false
DISABLE_PACKET_CAPTURE=false

# Development Settings
DEBUG=false
```

### Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3001` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `DISABLE_AUTO_CAPTURE` | Disable automatic packet capture on startup | `false` |
| `DISABLE_PACKET_CAPTURE` | Completely disable packet capture | `false` |
| `DEBUG` | Enable verbose logging | `false` |

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Build and start:**
   ```bash
   npm run docker:up
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f
   ```

3. **Stop:**
   ```bash
   npm run docker:down
   ```

### Using Docker Directly

1. **Build the image:**
   ```bash
   docker build -t packetview .
   ```

2. **Run with host networking** (required for packet capture):
   ```bash
   docker run -d \
     --network host \
     --cap-add NET_ADMIN \
     --cap-add NET_RAW \
     -e NODE_ENV=production \
     packetview
   ```

### Docker Configuration Notes

- Uses `host` network mode to access host network interfaces
- Runs with `NET_ADMIN` and `NET_RAW` capabilities for tcpdump
- Includes health check on `/health` endpoint
- Multi-stage build for optimized image size

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend and frontend in development mode |
| `npm run build` | Build both backend and frontend |
| `npm run test` | Run all tests |
| `npm run lint` | Run ESLint on all workspaces |
| `npm run format` | Format code with Prettier |
| `npm run clean` | Clean all build artifacts |
| `npm run backend:dev` | Start only backend in development |
| `npm run frontend:dev` | Start only frontend in development |
| `npm run backend:test` | Run backend tests |
| `npm run backend:lint` | Lint backend code |
| `npm run docker:up` | Build and start with Docker Compose |
| `npm run docker:down` | Stop Docker Compose services |

### Code Quality

- **ESLint**: Enforces code style and best practices
- **Prettier**: Automatic code formatting
- **Husky**: Git hooks for pre-commit and pre-push checks
- **lint-staged**: Run linters on staged files only

### Testing

Backend tests use Jest:

```bash
# Run all tests
npm run backend:test

# Run in watch mode
npm run backend:test:watch

# Generate coverage report
npm run backend:test:coverage
```

## Troubleshooting

### Permission Denied (tcpdump)

If you get "Permission denied" when starting capture:

```bash
# Give tcpdump required capabilities
sudo setcap cap_net_raw,cap_net_admin=eip /usr/bin/tcpdump

# Or run with sudo (not recommended for security)
sudo npm start
```

### No Network Interfaces Visible

1. Ensure tcpdump is installed and has proper permissions
2. Check that interfaces are up: `ip link show`
3. Verify DISABLE_AUTO_CAPTURE is set to false in .env

### WebSocket Connection Failed

1. Check backend is running: `curl http://localhost:3001/health`
2. Verify CORS settings if frontend is on different origin
3. Check firewall rules allow WebSocket connections

### Docker Container Cannot Capture Packets

1. Ensure container uses `--network host` or appropriate networking
2. Verify `NET_ADMIN` and `NET_RAW` capabilities are added
3. Check tcpdump is installed inside container

## Security Considerations

- Packet capture requires elevated privileges (`cap_net_raw`, `cap_net_admin`)
- Consider running in an isolated network environment
- Use environment variables to control auto-capture behavior
- Docker containers should be deployed with proper network isolation
- Do not expose the service directly to the public internet without authentication

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Built with Node.js, Express, and WebSocket
- Frontend uses Vite and HTML5 Canvas
- Packet capture powered by tcpdump and libpcap
- Visualization inspired by network monitoring tools
