import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { PacketCaptureService } from './services/PacketCaptureService';
import { NetworkAnalysisService } from './services/NetworkAnalysisService';
import { WebSocketMessage, WebSocketMessageType } from './shared/types';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;
const DEV_MODE = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

if (DEV_MODE) {
  console.log('========================================');
  console.log('PacketView Backend - DEVELOPMENT MODE');
  console.log('========================================');
  console.log(`Port: ${PORT}`);
  console.log(`Debug logging: ENABLED`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('========================================\n');
}

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Services
const packetCapture = new PacketCaptureService(DEV_MODE);
const networkAnalysis = new NetworkAnalysisService(DEV_MODE);

if (DEV_MODE) {
  console.log('[Server] Services initialized with logging enabled');
}

// Auto-start capture on all available interfaces
async function startAutoCapture() {
  try {
    const interfaces = await packetCapture.getInterfaces();
    const activeInterfaces = interfaces.filter(iface => iface.isUp).map(iface => iface.name);
    
    if (activeInterfaces.length > 0) {
      console.log(`[Server] Auto-starting capture on ${activeInterfaces.length} interfaces: ${activeInterfaces.join(', ')}`);
      await packetCapture.startMultiple(activeInterfaces);
      console.log('[Server] Auto-capture started successfully');
    } else {
      console.log('[Server] No active interfaces available for auto-capture');
    }
  } catch (error) {
    console.error('[Server] Failed to auto-start capture:', error);
  }
}

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }
}

app.use(express.json());

// API routes
app.get('/api/interfaces', async (req, res) => {
  try {
    if (DEV_MODE) {
      console.log('[API] GET /api/interfaces');
    }
    const interfaces = await packetCapture.getInterfaces();
    res.json({ interfaces });
  } catch (error) {
    console.error('[API] Error getting interfaces:', error);
    res.status(500).json({ error: 'Failed to get interfaces' });
  }
});

app.post('/api/capture/start', async (req, res) => {
  try {
    const { interface: iface, interfaces, filter } = req.body;

    if (DEV_MODE) {
      console.log(`[API] POST /api/capture/start: interface=${iface}, interfaces=${interfaces?.join(',') || 'none'}, filter=${filter || 'none'}`);
    }

    // Support both single interface (backward compatibility) and multiple interfaces
    const targetInterfaces = interfaces || (iface ? [iface] : []);

    if (targetInterfaces.length === 0) {
      if (DEV_MODE) {
        console.log('[API] Bad request: no interface specified');
      }
      return res.status(400).json({ error: 'At least one interface must be specified' });
    }

    if (targetInterfaces.length === 1) {
      // Single interface mode (backward compatibility)
      await packetCapture.start(targetInterfaces[0], filter);
    } else {
      // Multi-interface mode
      await packetCapture.startMultiple(targetInterfaces, filter);
    }

    if (DEV_MODE) {
      console.log(`[API] Capture started successfully on ${targetInterfaces.length} interface(s)`);
    }
    res.json({ 
      success: true, 
      message: `Capture started on ${targetInterfaces.length} interface(s)`,
      interfaces: targetInterfaces
    });
  } catch (error: any) {
    console.error('[API] Error starting capture:', error);
    res.status(500).json({ error: error.message || 'Failed to start capture' });
  }
});

app.post('/api/capture/stop', async (req, res) => {
  try {
    const { interface: iface } = req.body;

    if (DEV_MODE) {
      console.log(`[API] POST /api/capture/stop: interface=${iface || 'all'}`);
    }

    if (iface) {
      // Stop specific interface
      packetCapture.stopInterface(iface);
      if (DEV_MODE) {
        console.log(`[API] Capture stopped on interface ${iface}`);
      }
      res.json({ success: true, message: `Capture stopped on ${iface}` });
    } else {
      // Stop all interfaces (backward compatibility)
      packetCapture.stopAllInterfaces();
      if (DEV_MODE) {
        console.log('[API] All captures stopped');
      }
      res.json({ success: true, message: 'All captures stopped' });
    }
  } catch (error: any) {
    console.error('[API] Error stopping capture:', error);
    res.status(500).json({ error: error.message || 'Failed to stop capture' });
  }
});

app.get('/api/capture/status', (req, res) => {
  const status = packetCapture.getCaptureStatus();
  if (DEV_MODE) {
    console.log(`[API] GET /api/capture/status: active=${status.active}, interfaces=${status.interfaces.length}`);
  }
  res.json(status);
});

app.get('/api/capture/interfaces', (req, res) => {
  const activeInterfaces = packetCapture.getActiveInterfaces();
  if (DEV_MODE) {
    console.log(`[API] GET /api/capture/interfaces: active=${activeInterfaces.length}`);
  }
  res.json({ interfaces: activeInterfaces });
});

app.post('/api/capture/interfaces', async (req, res) => {
  try {
    const { interfaces } = req.body;

    if (DEV_MODE) {
      console.log(`[API] POST /api/capture/interfaces: interfaces=${interfaces?.join(',')}`);
    }

    if (!interfaces || interfaces.length === 0) {
      return res.status(400).json({ error: 'At least one interface must be specified' });
    }

    // Stop current capture and restart with new interfaces
    const currentStatus = packetCapture.getCaptureStatus();
    if (currentStatus.active) {
      await packetCapture.stopAllInterfaces();
    }

    // Start capture with new interface selection
    await packetCapture.startMultiple(interfaces);

    if (DEV_MODE) {
      console.log(`[API] Capture restarted with ${interfaces.length} interfaces`);
    }

    res.json({ success: true, interfaces });
  } catch (error: any) {
    console.error('[API] Error updating interfaces:', error);
    res.status(500).json({ error: error.message || 'Failed to update interfaces' });
  }
});

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  if (DEV_MODE) {
    console.log(`[WebSocket] New client connected. Total clients: ${wss.clients.size}`);
  }

  // Send initial interface list
  packetCapture.getInterfaces().then(interfaces => {
    const message: WebSocketMessage = {
      type: WebSocketMessageType.INTERFACE_LIST,
      data: interfaces,
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(message));
    if (DEV_MODE) {
      console.log(`[WebSocket] Sent interface list to client: ${interfaces.length} interfaces`);
    }
  });

  // Setup packet capture events
  packetCapture.on('packet', (packet) => {
    const analyzed = networkAnalysis.analyzePacket(packet);

    const message: WebSocketMessage = {
      type: WebSocketMessageType.PACKET,
      data: analyzed,
      timestamp: Date.now()
    };

    ws.send(JSON.stringify(message));
  });

  packetCapture.on('error', (error) => {
    console.error('[PacketCaptureService] Error:', error);
    const message: WebSocketMessage = {
      type: WebSocketMessageType.ERROR,
      data: { error: error.message },
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(message));
  });

  const STATE_UPDATE_INTERVAL = 500;
  let updateCount = 0;

  const stateInterval = setInterval(() => {
    updateCount++;
    const state = networkAnalysis.getNetworkState();

    const serializedState = {
      devices: Array.from(state.devices.values()),
      connections: Array.from(state.connections.values()),
      flows: state.flows
    };

    const message: WebSocketMessage = {
      type: WebSocketMessageType.NETWORK_STATE,
      data: serializedState,
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(message));

    if (DEV_MODE && updateCount % 30 === 0) {
      console.log(`[WebSocket] Sent state update #${updateCount}: ${serializedState.devices.length} devices, ${serializedState.connections.length} connections`);
    }
  }, STATE_UPDATE_INTERVAL);

  ws.on('close', () => {
    if (DEV_MODE) {
      console.log(`[WebSocket] Client disconnected. Total clients: ${wss.clients.size}`);
    }
    clearInterval(stateInterval);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  packetCapture.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  packetCapture.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log('========================================');
  console.log('PacketView Backend Server');
  console.log('========================================');
  console.log(`HTTP Server: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`Mode: ${DEV_MODE ? 'DEVELOPMENT (verbose logging)' : 'PRODUCTION'}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('========================================');
  console.log('Server ready and listening for connections...\n');
  
  // Start automatic capture after a short delay to ensure services are ready
  setTimeout(() => {
    startAutoCapture();
  }, 1000);
});
