# Multi-Interface Packet Capture Support

## Overview
PacketView now supports capturing packets simultaneously on multiple network interfaces, providing comprehensive network monitoring capabilities.

## Features Added

### 1. Multi-Interface Capture
- **Single Interface Mode**: Backward compatible single interface selection
- **Multiple Interface Mode**: Select and capture on multiple interfaces simultaneously
- **Per-Interface Process Management**: Independent tcpdump processes for each interface
- **Interface-Specific Packet Metadata**: Each packet includes the interface it was captured on

### 2. Enhanced UI Controls
- **Interface Mode Selector**: Switch between single and multiple interface modes
- **Multi-Select Checkboxes**: Select multiple interfaces when in multiple mode
- **Interface Filter**: Filter packets by which interface they were captured on
- **Per-Interface Status**: Track packet counts per interface

### 3. API Enhancements
- **Start Multiple Interfaces**: `/api/capture/start` accepts `interfaces` array
- **Stop Specific Interface**: `/api/capture/stop` accepts specific interface name
- **Enhanced Status**: `/api/capture/status` returns per-interface details
- **Active Interfaces**: `/api/capture/interfaces` returns currently active interfaces

### 4. Backend Architecture
- **Concurrent Process Management**: Multiple tcpdump processes running simultaneously
- **Map-Based Process Tracking**: Efficient process lookup by interface name
- **Graceful Cleanup**: Proper cleanup of individual or all processes
- **Error Isolation**: Failure on one interface doesn't affect others

## Usage Instructions

### Single Interface Mode (Backward Compatible)
1. Select "Single Interface" radio button
2. Choose interface from dropdown
3. Click "Start Capture"

### Multiple Interface Mode (New)
1. Select "Multiple Interfaces" radio button
2. Check desired interfaces in the checkbox list
3. Click "Start Capture"
4. Optionally filter by interface using the "Interface" filter dropdown

### Interface Filtering
- Use the "Interface" filter to show packets from specific interfaces only
- "All Interfaces" shows packets from all active capture interfaces
- Filter works in conjunction with IP and protocol filters

## Technical Implementation Details

### Backend Changes
- `PacketCaptureService`: Modified to handle Map<string, CaptureProcess> instead of single process
- `startMultiple()`: New method for parallel interface capture
- `stopInterface()`: New method for stopping individual interfaces
- `getCaptureStatus()`: Enhanced status with per-interface details

### Frontend Changes
- Dual-mode interface selection with radio buttons
- Checkbox-based multi-interface selection
- Interface filtering in visualization
- Enhanced filter options including interface-specific filtering

### Type System Updates
- `Packet.interface`: Optional field identifying capture interface
- `FilterOptions.interface`: Interface filter option
- `CaptureOptions.interfaces`: Array of interface names for multi-capture

## Testing

To test multi-interface functionality:

1. **Start Application**: Run `npm run dev`
2. **Open Frontend**: Navigate to http://localhost:5173
3. **Switch Mode**: Select "Multiple Interfaces" radio button
4. **Select Interfaces**: Check multiple available network interfaces
5. **Start Capture**: Click "Start Capture" button
6. **Monitor**: Observe packet capture from all selected interfaces
7. **Filter**: Use interface filter to isolate packets from specific interfaces

## Backward Compatibility

- All existing single interface functionality preserved
- Existing API endpoints work unchanged
- Frontend defaults to single interface mode
- No breaking changes to existing workflows

## Performance Considerations

- **Process Management**: Each interface runs independent tcpdump process
- **Memory Usage**: Proportional to number of active interfaces
- **CPU Usage**: Scales with number of interfaces and traffic
- **Recommendation**: Monitor system resources when using many interfaces