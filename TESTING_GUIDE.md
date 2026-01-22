# PacketView Testing Guide

## Quick Test Checklist

### 1. Start Servers

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 2. Verify Services Running

```bash
# Check backend
curl http://localhost:3001/api/interfaces

# Should return: {"interfaces":[{...}]}

# Check frontend
curl http://localhost:5173

# Should return HTML with "PacketView"
```

### 3. Test API Endpoints

#### Get Interfaces
```bash
curl http://localhost:3001/api/interfaces
```
✓ Expected: JSON with interfaces list

#### Get Capture Status (before capture)
```bash
curl http://localhost:3001/api/capture/status
```
✓ Expected: `{"capturing":false}`

#### Start Capture
```bash
curl -X POST http://localhost:3001/api/capture/start \
  -H "Content-Type: application/json" \
  -d '{"interface":"wlan0"}'
```
✓ Expected: `{"success":true,"message":"Capture started"}`

#### Get Capture Status (after start)
```bash
curl http://localhost:3001/api/capture/status
```
✓ Expected: `{"capturing":true}`

#### Stop Capture
```bash
curl -X POST http://localhost:3001/api/capture/stop
```
✓ Expected: `{"success":true,"message":"Capture stopped"}`

#### Get Capture Status (after stop)
```bash
curl http://localhost:3001/api/capture/status
```
✓ Expected: `{"capturing":false}`

### 4. Test Frontend Proxy

```bash
# Test API through Vite proxy
curl http://localhost:5173/api/interfaces

# Should return same as direct backend call
```

### 5. Test Through Browser

1. **Open browser**: `http://localhost:5173`

2. **Check browser console** (F12):
   - Should see: "WebSocket connecting to: ws://localhost:5173/ws"
   - Should see: "WebSocket connected"
   - Should see: "Loaded interfaces:" with array

3. **Verify UI**:
   - Control panel visible
   - Stats panel visible
   - Interface selector has interfaces (wlan0, docker0, etc.)
   - Start Capture button is enabled

4. **Start Capture**:
   - Select an interface (e.g., wlan0)
   - Click "Start Capture"
   - Check browser console: Should see "Starting capture on: wlan0"
   - Should see: "Capture started successfully"
   - Status should show: "Capturing" (green)

5. **Generate Traffic**:
   ```bash
   # In another terminal
   ping 8.8.8.8
   curl http://example.com
   ```

6. **Observe Visualization**:
   - Devices should appear (blue circles)
   - Connections should appear (lines between devices)
   - Statistics should update (packets, traffic, devices, connections)

7. **Stop Capture**:
   - Click "Stop Capture"
   - Check browser console: Should see "Stopping capture..."
   - Should see: "Capture stopped successfully"
   - Status should show: "Idle" (gray)

### 6. Test CORS

```bash
# Test CORS preflight request
curl -X OPTIONS http://localhost:3001/api/interfaces \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -I

# Should include: Access-Control-Allow-Origin: http://localhost:5173
```

### 7. Test BPF Filters

```bash
# Start capture with filter
curl -X POST http://localhost:3001/api/capture/start \
  -H "Content-Type: application/json" \
  -d '{"interface":"wlan0","filter":"port 80"}'

# Generate filtered traffic
curl http://example.com

# Only HTTP traffic should be captured
```

### 8. Test Error Handling

```bash
# Test invalid interface
curl -X POST http://localhost:3001/api/capture/start \
  -H "Content-Type: application/json" \
  -d '{"interface":"invalid"}'

# Should return error (tcpdump will fail)
```

### 9. Test Multiple Start/Stop Cycles

```bash
for i in {1..3}; do
  echo "Cycle $i: Start"
  curl -s -X POST http://localhost:3001/api/capture/start \
    -H "Content-Type: application/json" \
    -d '{"interface":"wlan0"}' > /dev/null
  sleep 2

  echo "Cycle $i: Stop"
  curl -s -X POST http://localhost:3001/api/capture/stop > /dev/null
  sleep 1
done

echo "All cycles completed"
```

### 10. Test with Real Traffic

```bash
# Start capture
curl -X POST http://localhost:3001/api/capture/start \
  -H "Content-Type: application/json" \
  -d '{"interface":"wlan0"}' > /dev/null

# Generate various traffic
ping -c 5 8.8.8.8 &        # ICMP
curl http://example.com &          # HTTP
curl https://www.google.com &       # HTTPS
nslookup google.com &              # DNS

wait

# Check statistics
curl http://localhost:3001/api/capture/status

# Stop capture
curl -X POST http://localhost:3001/api/capture/stop > /dev/null
```

## Troubleshooting Tests

### Test Fails with "NetworkError"?

**Cause**: Backend not running or CORS issue

**Fix**:
```bash
# 1. Check backend is running
curl http://localhost:3001/api/interfaces

# 2. If not, start it
cd backend && npm run dev

# 3. Wait 3 seconds, then try again
```

### Test Fails with "500 Internal Server Error"?

**Cause**: Backend error (check backend logs)

**Fix**:
```bash
# 1. Check backend logs
tail -50 /tmp/backend.log

# 2. Common causes:
#    - tcpdump not found: install tcpdump
#    - Permission denied: run with sudo
#    - Interface doesn't exist: use correct interface name
```

### Test Fails with "Failed to load interfaces"?

**Cause**: Frontend can't connect to backend

**Fix**:
```bash
# 1. Check backend URL is correct
curl http://localhost:3001/api/interfaces

# 2. Check frontend proxy is working
curl http://localhost:5173/api/interfaces

# 3. Check browser console for errors
#    Press F12, look for red errors
```

### WebSocket Connection Fails?

**Cause**: WebSocket endpoint not available

**Fix**:
```bash
# 1. Check WebSocket URL is correct
#    Browser console will show connection attempt

# 2. Verify backend WebSocket server is running
#    Backend logs should show: "WebSocket connected"

# 3. Check firewall is not blocking WS connections
```

## Test Summary

Create a test report:

```
Date: [date]
Tester: [your name]

Backend Status: [✓ / ✗]
Frontend Status: [✓ / ✗]

API Tests:
  - GET /api/interfaces:        [✓ / ✗]
  - GET /api/capture/status:      [✓ / ✗]
  - POST /api/capture/start:      [✓ / ✗]
  - POST /api/capture/stop:       [✓ / ✗]

Frontend Tests:
  - Interface selector:           [✓ / ✗]
  - Start capture button:          [✓ / ✗]
  - Stop capture button:           [✓ / ✗]
  - Status indicator:             [✓ / ✗]
  - Statistics display:           [✓ / ✗]

Functionality Tests:
  - Capture starts:               [✓ / ✗]
  - Capture stops:                [✓ / ✗]
  - Traffic visualization:          [✓ / ✗]
  - Statistics update:             [✓ / ✗]
  - Device tooltips:              [✓ / ✗]

Notes:
[any issues or observations]
```

## Running Automated Tests

Run the comprehensive test suite:

```bash
chmod +x comprehensive-test.sh
./comprehensive-test.sh
```

This will run all 20+ tests automatically and provide a summary.

## Manual Testing Steps

1. **Start both servers**
2. **Open browser to http://localhost:5173**
3. **Verify interface list loads**
4. **Select wlan0 (or available interface)**
5. **Click "Start Capture"**
6. **Generate traffic:**
   - Open a terminal and run: `ping 8.8.8.8`
   - Open browser and visit a website
7. **Verify devices appear in visualization**
8. **Verify statistics update**
9. **Click "Stop Capture"**
10. **Verify capture stops cleanly**

## Success Criteria

All tests pass if:
- ✓ Backend returns valid JSON responses
- ✓ Frontend loads without errors
- ✓ WebSocket connects successfully
- ✓ Interface selector shows available interfaces
- ✓ Start/Stop capture buttons work
- ✓ Traffic visualization shows devices and connections
- ✓ Statistics update in real-time
- **NO** console errors in browser
- **NO** console errors in backend
- Capture can be started and stopped repeatedly

## Known Issues

### Stop Capture Returns 500 Error

**Status**: FIXED

**Issue**: Stop capture endpoint was returning 500 Internal Server Error

**Fix**:
1. Added better error logging in stop endpoint
2. Added check for active capture before stopping
3. Improved process cleanup in PacketCaptureService.stop()
4. Added more detailed logging

**Verification**:
```bash
# Start capture
curl -X POST http://localhost:3001/api/capture/start \
  -H "Content-Type: application/json" \
  -d '{"interface":"wlan0"}' > /dev/null

sleep 2

# Stop capture
curl -X POST http://localhost:3001/api/capture/stop

# Should return: {"success":true,"message":"Capture stopped"}
```

## Next Steps

1. Run automated test suite: `./comprehensive-test.sh`
2. Perform manual browser testing
3. Document any issues found
4. Report bugs to development team
