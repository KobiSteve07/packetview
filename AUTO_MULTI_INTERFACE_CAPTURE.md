# Automatic Multi-Interface Packet Capture

## Overview
PacketView now automatically starts packet capture on all available network interfaces when the backend starts, with no manual controls required. Users can dynamically select which interfaces to monitor through the interface filter dropdown.

## ✅ New Features Implemented

### 1. Automatic Backend Startup
- **Auto-Start Function**: `startAutoCapture()` automatically detects all UP interfaces
- **Multi-Interface Launch**: Starts tcpdump processes on all available interfaces simultaneously
- **1-Second Delay**: Ensures all services are initialized before starting capture
- **No Manual Intervention**: No need to click start buttons or select interfaces

### 2. Real-Time Interface Selection
- **Dynamic Interface Filtering**: Users can select/deselect interfaces without restarting capture
- **Live Updates**: Changes immediately reflected in packet capture and visualization
- **REST API**: `/api/capture/interfaces` endpoint for real-time interface updates
- **Checkbox Interface Selection**: Simple checkboxes for each available interface
- **Interface Filter Dropdown**: Filter visualization by specific interface or "All Interfaces"

### 3. Enhanced User Experience
- **Always Capturing**: Backend automatically starts and maintains capture on all interfaces
- **Status Indicator**: Shows "Capturing" status when backend is running
- **No More Manual Controls**: Removed start/stop buttons to simplify interface
- **Persistent Selection**: Interface selections maintained during session

## 🔧 Technical Implementation

### Backend Changes
```typescript
// Auto-start capture on all available interfaces
async function startAutoCapture() {
  const interfaces = await packetCapture.getInterfaces();
  const activeInterfaces = interfaces.filter(iface => iface.isUp).map(iface => iface.name);
  
  if (activeInterfaces.length > 0) {
    await packetCapture.startMultiple(activeInterfaces);
    console.log(`Auto-starting capture on ${activeInterfaces.length} interfaces`);
  }
}

// Real-time interface updates API
app.post('/api/capture/interfaces', async (req, res) => {
  const { interfaces } = req.body;
  
  // Stop current capture and restart with new selection
  const currentStatus = packetCapture.getCaptureStatus();
  if (currentStatus.active) {
    await packetCapture.stopAllInterfaces();
  }
  
  // Start capture with new interface selection
  await packetCapture.startMultiple(interfaces);
});
```

### Frontend Changes
```typescript
// Real-time interface selection with checkboxes
private populateInterfaceCheckboxes(): void {
  this.interfaces.forEach(iface => {
    const checkbox = document.createElement('input');
    checkbox.checked = true; // All interfaces initially selected
    // ... create checkbox and label elements
  });
}

// Dynamic interface updates without capture restart
private updateSelectedInterfaces(): void {
  const currentlySelected = Array.from(checkboxes).map(cb => cb.value);
  
  // Send updates to backend in real-time
  fetch('/api/capture/interfaces', {
    method: 'POST',
    body: JSON.stringify({ interfaces: currentlySelected })
  });
}
```

## 🚀 Usage Instructions

### For System Administrators
1. **Start Backend**: Run `npm start` - capture begins automatically on all interfaces
2. **Monitor Status**: Check `/api/capture/status` to see active interfaces and packet counts
3. **Dynamic Interface Selection**: Use interface checkboxes to select/deselect interfaces without stopping capture
4. **Filter by Interface**: Use "Interface" dropdown to view packets from specific interfaces only

### For Users
1. **Automatic Capture**: Packet capture starts immediately when you connect
2. **Select Interfaces**: Check/uncheck network interface checkboxes
3. **Filter Traffic**: Use "Interface" dropdown to focus on specific interfaces
4. **View Statistics**: Real-time packet counts and connection status

## 🔄 API Endpoints

### New Endpoints
- `POST /api/capture/interfaces` - Update interface selection in real-time
- Response: `{ success: true, interfaces: string[] }`

### Enhanced Existing Endpoints
- `GET /api/capture/status` - Now returns per-interface packet counts
- Response: `{ active: boolean, interfaces: Array<{name: string, packetCount: number}> }`

## 📊 Benefits

1. **Zero Configuration**: No manual interface selection required
2. **Continuous Monitoring**: Uninterrupted packet capture across all interfaces
3. **Resource Efficiency**: Single tcpdump process per interface for optimal performance
4. **Operational Simplicity**: Always-on capture reduces user configuration complexity
5. **Real-Time Responsiveness**: Interface changes take effect immediately without restart

## ⚙️ Configuration

### Environment Variables
- `PORT` - Backend server port (default: 3001)
- `NODE_ENV` - Development/production mode
- `DEBUG` - Enable verbose logging

### Default Behavior
- **Auto-start**: Automatically starts on all UP interfaces
- **Interface Selection**: All interfaces selected by default
- **Filter Mode**: "All Interfaces" by default (shows packets from all active interfaces)

## 🔍 Monitoring

### Backend Logs
```
[Server] Auto-starting capture on 2 interfaces: lo, wlan0
[Server] Auto-capture started successfully
[API] POST /api/capture/interfaces: interfaces=lo,wlan0
[API] Capture restarted with 2 interfaces
```

### Frontend Logs
```
[Frontend] Received 2 network interfaces
[Frontend] Network state: 4 devices, 2 connections
```

The automatic multi-interface capture provides a seamless, set-it-and-forget-it experience for network monitoring with comprehensive visibility across all network interfaces.