import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { PacketCaptureService } from './services/PacketCaptureService';
import { NetworkAnalysisService } from './services/NetworkAnalysisService';
import { WebSocketMessage, WebSocketMessageType, Packet } from './shared/types';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { logger } from './utils/logger';
import { CONFIG } from './config/constants';
import dns from 'dns';

const app = express();
const server = createServer(app);

if (CONFIG.NODE_ENV === 'development') {
  logger.info('PacketView Backend - DEVELOPMENT MODE', { port: CONFIG.PORT, debugLogging: 'ENABLED', date: new Date().toISOString() });
}

app.use(cors({
  origin: CONFIG.CORS_ORIGINS,
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// WebSocket server
const wss = new WebSocketServer({ server, path: CONFIG.WEBSOCKET_PATH });

// Services
const packetCapture = new PacketCaptureService(CONFIG.NODE_ENV === 'development');
const networkAnalysis = new NetworkAnalysisService(CONFIG.NODE_ENV === 'development');

if (CONFIG.NODE_ENV === 'development') {
  logger.info('[Server] Services initialized with logging enabled');
}

// Auto-start capture on all available interfaces (only if not disabled)
async function startAutoCapture() {
  // Skip auto-capture if disabled
  if (CONFIG.DISABLE_AUTO_CAPTURE || CONFIG.DISABLE_PACKET_CAPTURE) {
    logger.info('[Server] Auto-capture disabled by environment variable');
    return;
  }
  
  try {
    const interfaces = await packetCapture.getInterfaces();
    const activeInterfaces = interfaces.filter(iface => iface.isUp).map(iface => iface.name);
    
    if (activeInterfaces.length > 0) {
      logger.info(`[Server] Auto-starting capture on ${activeInterfaces.length} interfaces: ${activeInterfaces.join(', ')}`);
      await packetCapture.startMultiple(activeInterfaces);
      logger.info('[Server] Auto-capture started successfully');
    } else {
      logger.info('[Server] No active interfaces available for auto-capture');
    }
  } catch (error) {
    logger.error('[Server] Failed to auto-start capture:', error);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    port: CONFIG.PORT
  });
});

app.use(express.json());

// API routes
app.get('/api/interfaces', async (req, res) => {
  try {
    if (CONFIG.NODE_ENV === 'development') {
      logger.info('[API] GET /api/interfaces');
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

    if (CONFIG.NODE_ENV === 'development') {
      logger.info(`[API] POST /api/capture/start: interface=${iface}, interfaces=${interfaces?.join(',') || 'none'}, filter=${filter || 'none'}`);
    }

    // Support both single interface (backward compatibility) and multiple interfaces
    const targetInterfaces = interfaces || (iface ? [iface] : []);

    if (targetInterfaces.length === 0) {
     if (CONFIG.NODE_ENV === 'development') {
       logger.info(`[API] Bad request: no interface specified`);
       return res.status(400).json({ error: 'At least one interface must be specified' });
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

    if (CONFIG.NODE_ENV === 'development') {
      logger.info(`[API] Capture started successfully on ${targetInterfaces.length} interface(s)`);
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

    if (CONFIG.NODE_ENV === 'development') {
      logger.info(`[API] POST /api/capture/stop: interface=${iface || 'all'}`);
    }

    if (iface) {
      // Stop specific interface
      packetCapture.stopInterface(iface);
      if (CONFIG.NODE_ENV === 'development') {
        console.log(`[API] Capture stopped on interface ${iface}`);
      }
      res.json({ success: true, message: `Capture stopped on ${iface}` });
    } else {
      // Stop all interfaces (backward compatibility)
      packetCapture.stopAllInterfaces();
      if (CONFIG.NODE_ENV === 'development') {
        logger.info('[API] All captures stopped');
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
  if (CONFIG.NODE_ENV === 'development') {
    logger.info(`[API] GET /api/capture/status: active=${status.active}, interfaces=${status.interfaces.length}`);
  }
  res.json(status);
});

app.get('/api/capture/interfaces', (req, res) => {
  const activeInterfaces = packetCapture.getActiveInterfaces();
  if (CONFIG.NODE_ENV === 'development') {
    logger.info(`[API] GET /api/capture/interfaces: active=${activeInterfaces.length}`);
  }
  res.json({ interfaces: activeInterfaces });
});

app.post('/api/capture/interfaces', async (req, res) => {
  try {
    const { interfaces } = req.body;

    if (CONFIG.NODE_ENV === 'development') {
      logger.info(`[API] POST /api/capture/interfaces: interfaces=${interfaces?.join(',')}`);
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

    if (CONFIG.NODE_ENV === 'development') {
      logger.info(`[API] Capture restarted with ${interfaces.length} interfaces`);
    }

    res.json({ success: true, interfaces });
  } catch (error: any) {
    console.error('[API] Error updating interfaces:', error);
    res.status(500).json({ error: error.message || 'Failed to update interfaces' });
  }
});

app.get('/api/reverse-dns/:ip', async (req, res) => {
  try {
    const { ip } = req.params;

    if (CONFIG.NODE_ENV === 'development') {
      logger.info(`[API] GET /api/reverse-dns/${ip}`);
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    const hostname = await dns.promises.reverse(ip).catch(() => null);

    if (hostname && hostname.length > 0) {
      res.json({ ip, hostname: hostname[0] });
    } else {
      res.json({ ip, hostname: null });
    }
  } catch (error: any) {
    console.error('[API] Error performing reverse DNS lookup:', error);
    res.status(500).json({ error: error.message || 'Failed to perform reverse DNS lookup' });
  }
});

app.post('/api/reverse-dns/batch', async (req, res) => {
  try {
    const { ips } = req.body;

    if (CONFIG.NODE_ENV === 'development') {
      logger.info(`[API] POST /api/reverse-dns/batch: ips=${ips?.join(',')}`);
    }

    if (!Array.isArray(ips) || ips.length === 0) {
      return res.status(400).json({ error: 'IPs array is required' });
    }

    if (ips.length > 100) {
      return res.status(400).json({ error: 'Batch size limited to 100 IPs' });
    }

    const results = await Promise.all(
      ips.map(async (ip: string) => {
        try {
          const hostnames = await dns.promises.reverse(ip);
          return { ip, hostname: hostnames[0] || null };
        } catch {
          return { ip, hostname: null };
        }
      })
    );

    res.json({ results });
  } catch (error: any) {
    console.error('[API] Error performing batch reverse DNS lookup:', error);
    res.status(500).json({ error: error.message || 'Failed to perform batch reverse DNS lookup' });
  }
});

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

function broadcastMessage(message: Omit<WebSocketMessage, 'timestamp'>) {
  const fullMessage: WebSocketMessage = {
    ...message,
    timestamp: Date.now()
  };

  const messageStr = JSON.stringify(fullMessage);
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });

  if (CONFIG.NODE_ENV === 'development') {
    logger.info(`[WebSocket] Broadcasted message: ${message.type} to ${wss.clients.size} clients`);
  }
}

wss.on('connection', (ws: WebSocket) => {
  if (CONFIG.NODE_ENV === 'development') {
    logger.info(`[WebSocket] New client connected. Total clients: ${wss.clients.size}`);
  }

  const networkState = networkAnalysis.getNetworkState();
  broadcastMessage({
    type: WebSocketMessageType.NETWORK_STATE,
    data: {
      devices: Array.from(networkState.devices.values()),
      connections: Array.from(networkState.connections.values()),
      flows: networkState.flows
    }
  });

  packetCapture.getInterfaces().then(interfaces => {
    broadcastMessage({
      type: WebSocketMessageType.INTERFACE_LIST,
      data: interfaces
    });
  });

  ws.on('close', () => {
    logger.info(`[WebSocket] Client disconnected. Total clients: ${wss.clients.size}`);
  });

  ws.on('error', (error) => {
    logger.error('[WebSocket] Error:', error);
  });
});

packetCapture.on('packet', (packet: Packet) => {
  networkAnalysis.analyzePacket(packet);
  broadcastMessage({
    type: WebSocketMessageType.PACKET,
    data: packet
  });
});

let networkStateInterval: NodeJS.Timeout;

function startNetworkStateBroadcast() {
  networkStateInterval = setInterval(() => {
    if (wss.clients.size > 0) {
      const networkState = networkAnalysis.getNetworkState();
      broadcastMessage({
        type: WebSocketMessageType.NETWORK_STATE,
        data: {
          devices: Array.from(networkState.devices.values()),
          connections: Array.from(networkState.connections.values()),
          flows: networkState.flows
        }
      });
    }
  }, 2000);
}

function stopNetworkStateBroadcast() {
  if (networkStateInterval) {
    clearInterval(networkStateInterval);
    networkStateInterval = undefined as any;
  }
}

wss.on('connection', () => {
  if (wss.clients.size === 1 && !networkStateInterval) {
    startNetworkStateBroadcast();
  }
});

wss.on('close', () => {
  if (wss.clients.size === 0 && networkStateInterval) {
    stopNetworkStateBroadcast();
  }
});

// Graceful shutdown
  process.on('SIGTERM', () => {
    packetCapture.stop();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

process.on('SIGINT', () => {
    packetCapture.stop();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

// Start server
server.listen(CONFIG.PORT, () => {
  logger.info('========================================');
  logger.info('PacketView Backend Server');
  logger.info('========================================');
  logger.info(`HTTP Server: http://localhost:${CONFIG.PORT}`);
  logger.info(`WebSocket: ws://localhost:${CONFIG.PORT}/ws`);
  logger.info(`Mode: ${CONFIG.NODE_ENV === 'development' ? 'DEVELOPMENT (verbose logging)' : 'PRODUCTION'}`);
  logger.info(`Date: ${new Date().toISOString()}`);
  logger.info('========================================');
  logger.info('Server ready and listening for connections...\n');
  
  // Start automatic capture after a short delay to ensure services are ready
  setTimeout(() => {
    startAutoCapture();
  }, 1000);
});

server.on('error', (error: any) => {
  logger.error('Server failed to start:', error);
  process.exit(1);
});
