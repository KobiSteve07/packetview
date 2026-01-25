# PacketView

A real-time 2D network traffic visualization tool similar to Cisco Packet Tracer, but for actual network traffic.

**This project is made in large part using OpenCode (and the Oh-My-Opencode plugin), which is an AI tool. You have been warned!**

## Features

- Real-time packet capture using tcpdump/libpcap
- 2D network topology visualization
- Cisco Packet Tracer-style interface
- Cross-platform compatibility (works with any tcpdump source)
- Protocol-based traffic color coding
- Interactive device inspection

## Architecture

- **Backend**: Node.js with packet capture and WebSocket streaming, CORS support
- **Frontend**: HTML5/TypeScript with Canvas rendering, API proxy for development

## Getting Started

### Prerequisites

- Node.js 18+
- libpcap (included with most Linux distributions)
- Root/sudo access for packet capture

### Installation

```bash
# Install all dependencies
npm run install:all

# Or install individually
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Running the Application

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

**Option 3: Use test script**
```bash
chmod +x test-app.sh
./test-app.sh
```

### Usage

1. Open the web interface (usually http://localhost:5173)
2. Select a network interface to monitor
3. Start capturing traffic (requires root/sudo for backend)
4. View real-time network visualization

**Note**: Packet capture requires elevated privileges. Run backend with:
```bash
sudo npm run dev
```

Or set capabilities for tcpdump:
```bash
sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)
```

## Development

```bash
# Backend
cd backend
npm run dev        # Development mode
npm run build      # Build for production

# Frontend
cd frontend
npm run dev        # Development mode
npm run build      # Build for production
npm run preview    # Preview production build
```

## Docker Deployment

### Prerequisites for Docker
- Docker 20.10+
- Docker Compose v2.0+
- Host system needs libpcap capabilities for packet capture

### Quick Start with Docker
```bash
# Build and start all services
docker-compose up --build -d

# Access the application
open http://localhost

# Stop services
docker-compose down
```

### Packet Capture in Docker

⚠️ **Important**: Packet capture requires elevated privileges in containers.

#### Option 1: Enable Privileged Mode
Uncomment line 19 in `docker-compose.yml`:
```yaml
privileged: true  # Uncomment for packet capture in production
```

#### Option 2: Use Development Config
```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

#### Option 3: Manual Privileges
```bash
docker-compose up --build -d --privileged
```

### Docker Services
- **Frontend**: Available at http://localhost (Nginx on port 80)
- **Backend**: Available at http://localhost:3001 (Node.js API) 
- **WebSocket**: ws://localhost:3001/ws (real-time packet data)

### Docker Development
```bash
# Build individual services
docker-compose build backend
docker-compose build frontend

# Run specific service
docker-compose up backend
docker-compose up frontend

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Production Considerations
- Packet capture requires `NET_RAW` and `NET_ADMIN` capabilities or privileged mode
- Backend runs as non-root user but still needs capabilities  
- Frontend uses Nginx with security headers and gzip compression
- Health checks configured for both services
- See `DOCKER.md` for detailed deployment guide

### Docker Troubleshooting
```bash
# Check container status
docker-compose ps

# View real-time logs
docker-compose logs -f

# Restart services
docker-compose restart

# Clean up containers and images
docker-compose down -v --rmi all
```

### Documentation
📖 See `DOCKER.md` for comprehensive Docker deployment guide.

## Testing


## Testing

Multiple testing resources are provided:

### Quick Test
```bash
./test-app.sh
```

Quick health check that verifies:
- Backend API accessible on port 3001
- Frontend running on port 5173
- HTML content loading correctly

### Comprehensive Test Suite
```bash
chmod +x comprehensive-test.sh
./comprehensive-test.sh
```

Automated test suite with 20+ tests covering:
- API endpoints (GET, POST, status)
- Frontend proxy functionality
- CORS headers verification
- Multiple start/stop cycles
- Error handling
- Concurrent requests

### Testing Guide
See `TESTING_GUIDE.md` for:
- Manual testing procedures
- API endpoint tests
- Browser test steps
- Troubleshooting checklist
- Success criteria

### Known Issues & Fixes

See these documentation files for detailed bug fixes and resolutions:
- `CORS_FIX.md` - CORS network error fix
- `BUG_FIXES.md` - Complete bug log
- `STOP_CAPTURE_FIX.md` - Stop capture issue fix

### Quick Manual Test

```bash
# 1. Start both servers
cd backend && npm run dev &
cd frontend && npm run dev &

# 2. Open browser
# Navigate to: http://localhost:5173

# 3. Test functionality
# - Select interface
# - Start capture
# - Generate traffic (ping, curl)
# - Verify visualization
# - Stop capture
```
