#!/bin/bash

echo "Testing PacketView Application"
echo "=================================="
echo ""

if curl -s http://localhost:3001/api/interfaces > /dev/null 2>&1; then
    echo "✓ Backend is running"
    INTERFACES=$(curl -s http://localhost:3001/api/interfaces)
    INTERFACE_COUNT=$(echo "$INTERFACES" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data['interfaces']))")
    echo "  Found $INTERFACE_COUNT network interfaces"
else
    echo "✗ Backend is not running"
    echo "  Starting backend..."
    cd backend && npm run dev &
    sleep 3
fi

echo ""

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✓ Frontend is running"
    if curl -s http://localhost:5173 | grep -q "PacketView"; then
        echo "  HTML loaded correctly"
    else
        echo "  HTML content issue"
    fi
else
    echo "✗ Frontend is not running"
    echo "  Starting frontend..."
    cd frontend && npm run dev &
    sleep 3
fi

echo ""

if command -v websocat &> /dev/null; then
    echo "Testing WebSocket connection..."
    if timeout 2 websocat ws://localhost:3001/ws 2>&1 | grep -q "Connected"; then
        echo "✓ WebSocket connection successful"
    else
        echo "✗ WebSocket connection failed"
    fi
else
    echo "Note: Install websocat to test WebSocket connection"
fi

echo ""
echo "Test Summary"
echo "============"
echo "Backend API:  http://localhost:3001/api"
echo "Frontend URL:  http://localhost:5173"
echo "WebSocket URL:  ws://localhost:3001/ws"
echo ""
echo "To test the application:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Select a network interface"
echo "3. Click 'Start Capture'"
echo "4. Generate some network traffic (ping, curl, etc.)"
echo "5. Check visualization for devices and connections"
echo ""
echo "Servers are running. Press Ctrl+C to stop test script (servers will continue)."

wait
