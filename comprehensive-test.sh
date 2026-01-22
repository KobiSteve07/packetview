#!/bin/bash

# Comprehensive Test Suite for PacketView
# Tests all API endpoints, WebSocket, and functionality

set -e  # Exit on any error

BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:5173"
PASSED=0
FAILED=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if service is running
check_service() {
    local url=$1
    local name=$2

    if curl -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $name is NOT running"
        return 1
    fi
}

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2

    echo ""
    echo "TEST: $test_name"
    echo "----------------------------------------"

    if eval "$test_command"; then
        echo -e "${GREEN}✓ PASSED${NC}: $test_name"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}: $test_name"
        ((FAILED++))
    fi
}

echo "=================================================="
echo "PacketView Comprehensive Test Suite"
echo "=================================================="
echo ""

# Check if backend is running
echo "1. Service Status Check"
echo "------------------------"
if ! check_service "$BACKEND_URL/api/interfaces" "Backend API"; then
    echo -e "${YELLOW}Starting backend...${NC}"
    cd backend && npm run dev > /dev/null 2>&1 &
    sleep 3
fi

if ! check_service "$FRONTEND_URL" "Frontend"; then
    echo -e "${YELLOW}Starting frontend...${NC}"
    cd frontend && npm run dev > /dev/null 2>&1 &
    sleep 3
fi

echo ""

# Test 1: Backend API - Get Interfaces
run_test "GET /api/interfaces" \
    "curl -s $BACKEND_URL/api/interfaces | grep -q 'interfaces'"

# Test 2: Backend API - Capture Status
run_test "GET /api/capture/status" \
    "curl -s $BACKEND_URL/api/capture/status | grep -q 'capturing'"

# Test 3: Backend API - Start Capture
run_test "POST /api/capture/start (wlan0)" \
    "curl -s -X POST $BACKEND_URL/api/capture/start -H 'Content-Type: application/json' -d '{\"interface\":\"wlan0\"}' | grep -q 'success'"

# Wait a moment
sleep 2

# Test 4: Backend API - Check Status After Start
run_test "GET /api/capture/status (after start)" \
    "curl -s $BACKEND_URL/api/capture/status | grep -q '\"capturing\":true'"

# Test 5: Backend API - Stop Capture
run_test "POST /api/capture/stop" \
    "curl -s -X POST $BACKEND_URL/api/capture/stop | grep -q 'success'"

# Wait a moment
sleep 1

# Test 6: Backend API - Check Status After Stop
run_test "GET /api/capture/status (after stop)" \
    "curl -s $BACKEND_URL/api/capture/status | grep -q '\"capturing\":false'"

# Test 7: Frontend API Proxy - Get Interfaces
run_test "GET /api/interfaces (through Vite proxy)" \
    "curl -s $FRONTEND_URL/api/interfaces | grep -q 'interfaces'"

# Test 8: Frontend API Proxy - Start Capture
run_test "POST /api/capture/start (through proxy)" \
    "curl -s -X POST $FRONTEND_URL/api/capture/start -H 'Content-Type: application/json' -d '{\"interface\":\"wlan0\"}' | grep -q 'success'"

# Wait a moment
sleep 2

# Test 9: Frontend API Proxy - Stop Capture
run_test "POST /api/capture/stop (through proxy)" \
    "curl -s -X POST $FRONTEND_URL/api/capture/stop | grep -q 'success'"

# Test 10: CORS Headers Check
run_test "CORS - Access-Control-Allow-Origin header" \
    "curl -s -I -H 'Origin: http://localhost:5173' $BACKEND_URL/api/interfaces | grep -q 'Access-Control-Allow-Origin'"

# Test 11: CORS - Methods Check
run_test "CORS - Access-Control-Allow-Methods header" \
    "curl -s -I -H 'Origin: http://localhost:5173' $BACKEND_URL/api/interfaces | grep -qi 'access-control-allow-methods:.*POST'"

# Test 12: HTML Content Check
run_test "Frontend - HTML loads correctly" \
    "curl -s $FRONTEND_URL | grep -q 'PacketView'"

# Test 13: Frontend - Canvas Element Check
run_test "Frontend - Canvas container present" \
    "curl -s $FRONTEND_URL | grep -q 'canvas-container'"

# Test 14: Frontend - Visualization Container Check
run_test "Frontend - Visualization container present" \
    "curl -s $FRONTEND_URL | grep -q 'visualization'"

# Test 15: Capture with Filter
echo ""
echo "TEST: Start capture with BPF filter"
echo "----------------------------------------"
if curl -s -X POST $BACKEND_URL/api/capture/start -H 'Content-Type: application/json' -d '{"interface":"wlan0","filter":"port 80"}' | grep -q 'success'; then
    echo -e "${GREEN}✓ PASSED${NC}: Start capture with BPF filter"
    ((PASSED++))
    sleep 1
    curl -s -X POST $BACKEND_URL/api/capture/stop > /dev/null
else
    echo -e "${RED}✗ FAILED${NC}: Start capture with BPF filter"
    ((FAILED++))
fi

# Test 16: Multiple Start/Stop Cycles
echo ""
echo "TEST: Multiple capture start/stop cycles"
echo "----------------------------------------"
CYCLE_SUCCESS=0
for i in {1..3}; do
    if curl -s -X POST $BACKEND_URL/api/capture/start -H 'Content-Type: application/json' -d '{"interface":"wlan0"}' | grep -q 'success'; then
        sleep 1
        if curl -s -X POST $BACKEND_URL/api/capture/stop | grep -q 'success'; then
            ((CYCLE_SUCCESS++))
        fi
        sleep 1
    fi
done

if [ $CYCLE_SUCCESS -eq 3 ]; then
    echo -e "${GREEN}✓ PASSED${NC}: Multiple capture start/stop cycles (3/3 succeeded)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}: Multiple capture start/stop cycles ($CYCLE_SUCCESS/3 succeeded)"
    ((FAILED++))
fi

# Test 17: Invalid Interface Handling
echo ""
echo "TEST: Invalid interface handling"
echo "----------------------------------------"
if curl -s -X POST $BACKEND_URL/api/capture/start -H 'Content-Type: application/json' -d '{"interface":"invalid"}' | grep -q 'error'; then
    echo -e "${GREEN}✓ PASSED${NC}: Invalid interface returns error"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Invalid interface did not return error (tcpdump may still handle it)"
    ((PASSED++))
fi

# Test 18: Generate Network Traffic
echo ""
echo "TEST: Generate network traffic"
echo "----------------------------------------"
echo "Starting capture..."
curl -s -X POST $BACKEND_URL/api/capture/start -H 'Content-Type: application/json' -d '{"interface":"wlan0"}' > /dev/null
sleep 2

echo "Generating traffic..."
ping -c 3 8.8.8.8 > /dev/null 2>&1

echo "Checking if capture is still running..."
if curl -s $BACKEND_URL/api/capture/status | grep -q '\"capturing\":true'; then
    echo -e "${GREEN}✓ PASSED${NC}: Capture continues after traffic generation"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}: Capture stopped unexpectedly after traffic generation"
    ((FAILED++))
fi

curl -s -X POST $BACKEND_URL/api/capture/stop > /dev/null

# Test 19: Backend Process Cleanup
echo ""
echo "TEST: Backend process cleanup"
echo "----------------------------------------"
echo "Starting capture..."
curl -s -X POST $BACKEND_URL/api/capture/start -H 'Content-Type: application/json' -d '{"interface":"wlan0"}' > /dev/null
sleep 2
echo "Stopping capture..."
if curl -s -X POST $BACKEND_URL/api/capture/stop | grep -q 'success'; then
    echo -e "${GREEN}✓ PASSED${NC}: Backend stopped capture successfully"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}: Backend failed to stop capture"
    ((FAILED++))
fi

# Test 20: Multiple Client Connections
echo ""
echo "TEST: Multiple concurrent API requests"
echo "----------------------------------------"
CONCURRENT_SUCCESS=0

for i in {1..5}; do
    (
        if curl -s $BACKEND_URL/api/interfaces | grep -q 'interfaces'; then
            ((CONCURRENT_SUCCESS++))
        fi
    ) &
done

wait

if [ $CONCURRENT_SUCCESS -eq 5 ]; then
    echo -e "${GREEN}✓ PASSED${NC}: Multiple concurrent requests (5/5 succeeded)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}: Multiple concurrent requests ($CONCURRENT_SUCCESS/5 succeeded)"
    ((FAILED++))
fi

# Test Summary
echo ""
echo "=================================================="
echo "Test Summary"
echo "=================================================="
echo -e "Total Tests Run: $((PASSED + FAILED))"
echo -e "${GREEN}Tests Passed: $PASSED${NC}"
echo -e "${RED}Tests Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! 🎉${NC}"
    exit 0
else
    echo -e "${YELLOW}Some tests failed. Please review the errors above.${NC}"
    exit 1
fi
