import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  WEBSOCKET_PATH: '/ws',
  RECONNECT_DELAY: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
  
  CORS_ORIGINS: ['http://localhost:5173', 'http://127.0.0.1:5173'] as string[],
  DISABLE_AUTO_CAPTURE: process.env.DISABLE_AUTO_CAPTURE === 'true',
  DISABLE_PACKET_CAPTURE: process.env.DISABLE_PACKET_CAPTURE === 'true',
  
  DEBUG_MODE: process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true',
  
  STATE_UPDATE_INTERVAL: 500,
  STATS_UPDATE_COUNT: 30,
  
  CANVAS_WIDTH: 1200,
  CANVAS_HEIGHT: 800,
  DEVICE_RADIUS: 20,
  
  LOCAL_IP_PATTERNS: [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./, /^127\./],
  BROADCAST_IP_SUFFIX: '.255',
  MULTICAST_IP_RANGES: [/^224\./, /^239\./],
  
  PROTOCOL_PORTS: {
    HTTP: 80,
    HTTPS: 443,
    DNS: 53,
    SSH: 22,
    FTP: 21,
    SMTP: 25
  },
  
  MAX_LOG_SIZE: 5242880,
  MAX_LOG_FILES: 5,
  
  HIGH_TRAFFIC_THRESHOLD: 1000000,
  ACTIVE_TIMEOUT: 300000
} as const;