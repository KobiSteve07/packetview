export const FRONTEND_CONFIG = {
  WEBSOCKET_URL: (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : 'ws://localhost:3001/ws',
  API_BASE_URL: (typeof process !== 'undefined' && process.env.NODE_ENV === 'production')
    ? '/api'
    : 'http://localhost:3001/api',
    
  CANVAS_WIDTH: 1200,
  CANVAS_HEIGHT: 800,
  DEVICE_RADIUS: 20,
  
  ANIMATION_DURATION: 1000,
  PACKET_ANIMATION_SPEED: 2,
  
  FILTER_DEBOUNCE_DELAY: 300,
  
  STATS_UPDATE_INTERVAL: 5000
} as const;