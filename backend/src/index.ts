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
    const { interface: iface, filter } = req.body;

    if (DEV_MODE) {
      console.log(`[API] POST /api/capture/start: interface=${iface}, filter=${filter || 'none'}`);
    }

    if (!iface) {
      if (DEV_MODE) {
        console.log('[API] Bad request: interface missing');
      }
      return res.status(400).json({ error: 'Interface is required' });
    }

    await packetCapture.start(iface, filter);

    if (DEV_MODE) {
      console.log('[API] Capture started successfully');
    }
    res.json({ success: true, message: 'Capture started' });
  } catch (error: any) {
    console.error('[API] Error starting capture:', error);
    res.status(500).json({ error: error.message || 'Failed to start capture' });
  }
});

app.post('/api/capture/stop', async (req, res) => {
  if (DEV_MODE) {
    console.log('[API] POST /api/capture/stop');
  }

  try {
    packetCapture.stop();
    if (DEV_MODE) {
      console.log('[API] Capture stopped successfully');
    }
    res.json({ success: true, message: 'Capture stopped' });
  } catch (error: any) {
    console.error('[API] Error stopping capture:', error);
    res.status(500).json({ error: error.message || 'Failed to stop capture' });
  }
});

app.get('/api/capture/status', (req, res) => {
  const isCapturing = packetCapture.isCapturingActive();
  if (DEV_MODE) {
    console.log(`[API] GET /api/capture/status: capturing=${isCapturing}`);
  }
  res.json({ capturing: isCapturing });
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

  const STATE_UPDATE_INTERVAL = 1000;
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
});
