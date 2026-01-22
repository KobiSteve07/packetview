# PacketView - CORS/Network Error Fix Summary

## Problem
You encountered this error when trying to start packet capture:

```
Failed to start capture: NetworkError when attempting to fetch resource.
```

## Root Cause
The error occurred due to **CORS (Cross-Origin Resource Sharing)** policy restrictions:

1. **Frontend origin**: `http://localhost:5173` (Vite dev server)
2. **Backend origin**: `http://localhost:3001` (Express server)
3. **Issue**: Browsers block POST requests between different origins for security

When you clicked "Start Capture", the frontend made a POST request to `http://localhost:3001/api/capture/start`. The browser blocked this request because it originated from a different port, violating the same-origin policy.

## Solution Implemented

### 1. Added CORS Support to Backend
```typescript
// backend/src/index.ts
import cors from 'cors';

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));
```

### 2. Configured Vite Proxy
```typescript
// frontend/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
```

### 3. Updated Frontend API Calls
```typescript
// frontend/src/main.ts
// Before: Direct cross-origin requests
await fetch('http://localhost:3001/api/interfaces');

// After: Proxied requests (same origin)
await fetch('/api/interfaces');
```

### 4. Dynamic WebSocket URL
```typescript
// frontend/src/services/api.ts
private getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
}
```

## How It Works Now

### Development Mode (Current)
```
Frontend (http://localhost:5173)
    ↓ (User interaction)
Fetch '/api/interfaces' → Vite Proxy → Backend (http://localhost:3001)
    ↓ (Response)
Backend response → Vite Proxy → Frontend

WebSocket connection:
Frontend → ws://localhost:5173/ws → Vite Proxy → ws://localhost:3001/ws
```

**Result**: All requests appear to be from the same origin. No CORS errors!

### Production Mode
In production, you'll serve both backend and frontend from the same domain/port, or configure your web server (Nginx, Apache) to proxy requests correctly.

## Files Modified

### Backend
1. `backend/package.json` - Added `cors` dependency
2. `backend/package.json` - Added `@types/cors` dev dependency
3. `backend/src/index.ts` - Imported and configured CORS middleware

### Frontend
1. `frontend/vite.config.ts` - Added proxy configuration for `/api` and `/ws`
2. `frontend/src/main.ts` - Changed all API calls to use proxy paths
3. `frontend/src/services/api.ts` - Added dynamic WebSocket URL detection

## How to Test

### Quick Test
1. Ensure both servers are running:
   ```bash
   # Terminal 1
   cd backend
   npm run dev

   # Terminal 2
   cd frontend
   npm run dev
   ```

2. Open browser: `http://localhost:5173`

3. Select a network interface (e.g., `wlan0`)

4. Click "Start Capture"

5. **Expected Result**: Capture starts successfully, no network errors

### Verify Proxy is Working
```bash
# Test API through Vite proxy
curl http://localhost:5173/api/interfaces

# Should return:
{"interfaces":[{...}]}
```

### Generate Traffic
```bash
# Generate some traffic to test visualization
ping 8.8.8.8
curl http://example.com
```

## Troubleshooting

### Still Getting Network Errors?

1. **Check if backend is running**:
   ```bash
   curl http://localhost:3001/api/interfaces
   ```

2. **Check if frontend is running**:
   ```bash
   curl http://localhost:5173
   ```

3. **Check browser console** (F12):
   - Look for red error messages
   - Check Network tab for failed requests
   - Verify requests are going to `/api/*` (not `http://localhost:3001/api/*`)

4. **Restart both servers**:
   ```bash
   pkill -f tsx vite
   cd backend && npm run dev &
   cd frontend && npm run dev &
   ```

5. **Clear browser cache**:
   - Chrome: Ctrl+Shift+R (hard refresh)
   - Firefox: Ctrl+F5 (hard refresh)
   - Edge: Ctrl+F5 (hard refresh)

### CORS Errors in Browser Console?

If you still see CORS errors:
1. Check backend has CORS middleware enabled
2. Verify backend is running on port 3001
3. Check that frontend is proxying requests through Vite
4. Try direct CORS test:
   ```bash
   curl -H "Origin: http://localhost:5173" \
         -H "Access-Control-Request-Method: POST" \
         -X OPTIONS http://localhost:3001/api/capture/start
   ```
   Should include: `Access-Control-Allow-Origin: http://localhost:5173`

### WebSocket Connection Issues?

If WebSocket fails to connect:
1. Check browser console for WebSocket errors
2. Verify WebSocket proxy is configured in `vite.config.ts`
3. Ensure backend WebSocket server is listening
4. Test WebSocket directly:
   ```bash
   # Using websocat
   websocat ws://localhost:3001/ws

   # Using wscat
   wscat -c ws://localhost:3001/ws
   ```

## Summary

✅ **Fixed**: CORS network error on API calls
✅ **Added**: Vite proxy for development
✅ **Updated**: All frontend API calls to use proxy
✅ **Improved**: WebSocket connection handling
✅ **Tested**: API calls work through proxy

The application now works without CORS errors in development mode. When you click "Start Capture", the request goes through Vite's proxy to the backend, bypassing CORS restrictions.

## Next Steps

1. Start both servers (`npm run dev` in each directory)
2. Open `http://localhost:5173` in your browser
3. Select a network interface
4. Click "Start Capture"
5. Generate traffic with `ping`, `curl`, or web browsing
6. Observe devices and connections in the visualization
7. Monitor statistics in the stats panel

The CORS issue is completely resolved! 🎉
