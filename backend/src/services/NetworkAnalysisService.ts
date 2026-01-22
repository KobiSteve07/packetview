import { Packet, NetworkDevice, DeviceType, NetworkConnection, NetworkState, Protocol } from '../shared/types';

export class NetworkAnalysisService {
  private devices: Map<string, NetworkDevice>;
  private connections: Map<string, NetworkConnection>;
  private logEnabled: boolean;
  private collisionCheckCounter: number = 0;

  constructor(logEnabled: boolean = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    this.devices = new Map();
    this.connections = new Map();
    this.logEnabled = logEnabled;
    if (this.logEnabled) {
      console.log('[NetworkAnalysisService] Initialized with logging enabled');
    }
  }

  analyzePacket(packet: Packet): Packet {
    if (this.logEnabled) {
      console.log('[NetworkAnalysisService] Analyzing packet:', {
        sourceIp: packet.sourceIp,
        destIp: packet.destIp,
        protocol: packet.protocol,
        size: packet.size
      });
    }
    this.updateDevice(packet);
    this.updateConnection(packet);
    return packet;
  }

  private updateDevice(packet: Packet): void {
    const sourceMac = packet.info?.match(/MAC:\s*([a-fA-F0-9:]+)\s*->/)?.[1] || '';
    const destMac = packet.info?.match(/->\s*([a-fA-F0-9:]+)$/)?.[1] || '';

    if (!this.isSpecialAddress(packet.sourceIp)) {
      this.ensureDeviceExists(packet.sourceIp, sourceMac);
      const sourceDevice = this.devices.get(packet.sourceIp);
      if (sourceDevice && this.logEnabled) {
        console.log(`[NetworkAnalysisService] Source device updated: ${packet.sourceIp}, type: ${sourceDevice.type}`);
      }
    } else if (this.logEnabled) {
      console.log(`[NetworkAnalysisService] Skipping special source address: ${packet.sourceIp}`);
    }

    if (!this.isSpecialAddress(packet.destIp)) {
      this.ensureDeviceExists(packet.destIp, destMac);
      const destDevice = this.devices.get(packet.destIp);
      if (destDevice && this.logEnabled) {
        console.log(`[NetworkAnalysisService] Destination device updated: ${packet.destIp}, type: ${destDevice.type}`);
      }
    } else if (this.logEnabled) {
      console.log(`[NetworkAnalysisService] Skipping special destination address: ${packet.destIp}`);
    }
  }

  private isSpecialAddress(ip: string): boolean {
    return ip.startsWith('127.') ||
           ip.startsWith('255.') ||
           ip.startsWith('224.') ||
           ip.startsWith('239.') ||
           ip === '0.0.0.0' ||
           ip === '255.255.255.255';
  }

  private ensureDeviceExists(ip: string, mac: string = ''): void {
    if (!this.devices.has(ip)) {
      const device: NetworkDevice = {
        id: ip,
        ip,
        mac,
        type: this.detectDeviceType(ip),
        x: Math.random() * 2000,
        y: Math.random() * 1500,
        trafficIn: 0,
        trafficOut: 0,
        lastSeen: 0
      };
      this.devices.set(ip, device);
      this.resolveCollisions(device);

      if (this.logEnabled) {
        console.log(`[NetworkAnalysisService] NEW DEVICE discovered: ${ip}, MAC: ${mac || 'N/A'}, type: ${device.type}, position: (${device.x.toFixed(0)}, ${device.y.toFixed(0)})`);
      }
    } else {
      const device = this.devices.get(ip);
      if (device && mac && !device.mac) {
        device.mac = mac;
        if (this.logEnabled) {
          console.log(`[NetworkAnalysisService] Updated MAC for device ${ip}: ${mac}`);
        }
      }
      if (device && this.logEnabled) {
        const trafficTotal = device.trafficIn + device.trafficOut;
        if (trafficTotal > 0) {
          console.log(`[NetworkAnalysisService] Device ${ip} stats - Type: ${device.type}, In: ${device.trafficIn}B, Out: ${device.trafficOut}B, Total: ${trafficTotal}B, Last seen: ${new Date(device.lastSeen).toISOString()}`);
        }
      }
    }
  }

  private resolveCollisions(newDevice: NetworkDevice): void {
    const newDeviceRadius = this.getDeviceRadius(newDevice);
    const separationAttempts = 100;
    let attempts = 0;

    while (attempts < separationAttempts) {
      let hasCollision = false;

      for (const [ip, device] of this.devices) {
        if (ip === newDevice.id) continue;

        const deviceRadius = this.getDeviceRadius(device);
        const minDistance = newDeviceRadius + deviceRadius + 50;
        const dx = device.x - newDevice.x;
        const dy = device.y - newDevice.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          hasCollision = true;
          const angle = Math.atan2(dy, dx);
          const separationForce = (minDistance - distance) / 2;

          newDevice.x -= Math.cos(angle) * separationForce;
          newDevice.y -= Math.sin(angle) * separationForce;

          device.x += Math.cos(angle) * separationForce;
          device.y += Math.sin(angle) * separationForce;
        }
      }

      if (!hasCollision) break;
      attempts++;
    }

    newDevice.x = Math.max(50, Math.min(1950, newDevice.x));
    newDevice.y = Math.max(50, Math.min(1450, newDevice.y));
  }

  private getDeviceRadius(device: NetworkDevice): number {
    const baseRadius = 25;
    const trafficBonus = Math.min((device.trafficIn + device.trafficOut) / 10000, 15);
    return baseRadius + trafficBonus;
  }

  private resolveAllCollisions(): void {
    const separationAttempts = 50;

    for (let attempt = 0; attempt < separationAttempts; attempt++) {
      let hasCollision = false;

      for (const [ip1, device1] of this.devices) {
        for (const [ip2, device2] of this.devices) {
          if (ip1 >= ip2) continue;

          const radius1 = this.getDeviceRadius(device1);
          const radius2 = this.getDeviceRadius(device2);
          const minDistance = radius1 + radius2 + 50;
          const dx = device2.x - device1.x;
          const dy = device2.y - device1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < minDistance) {
            hasCollision = true;
            const angle = Math.atan2(dy, dx);
            const separationForce = (minDistance - distance) / 2;

            device1.x -= Math.cos(angle) * separationForce;
            device1.y -= Math.sin(angle) * separationForce;

            device2.x += Math.cos(angle) * separationForce;
            device2.y += Math.sin(angle) * separationForce;
          }
        }
      }

      if (!hasCollision) break;

      for (const device of this.devices.values()) {
        device.x = Math.max(50, Math.min(1950, device.x));
        device.y = Math.max(50, Math.min(1450, device.y));
      }
    }
  }

  private detectDeviceType(ip: string): DeviceType {
    if (ip.startsWith('127.') || ip === '0.0.0.0') {
      return DeviceType.UNKNOWN;
    }

    if (ip.endsWith('.1') && (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.'))) {
      return DeviceType.GATEWAY;
    }

    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return DeviceType.HOST;
    }

    return DeviceType.HOST;
  }

  private updateConnection(packet: Packet): void {
    const connectionId = this.getConnectionId(packet);
    let connection = this.connections.get(connectionId);

    if (!connection) {
      connection = {
        id: connectionId,
        sourceId: packet.sourceIp,
        destId: packet.destIp,
        protocol: packet.protocol,
        traffic: 0,
        packets: 0,
        lastSeen: packet.timestamp
      };
      this.connections.set(connectionId, connection);
      if (this.logEnabled) {
        console.log(`[NetworkAnalysisService] NEW connection: ${packet.sourceIp}:${packet.sourcePort} -> ${packet.destIp}:${packet.destPort} (${packet.protocol})`);
      }
    }

    connection.traffic += packet.size;
    connection.packets += 1;
    connection.lastSeen = packet.timestamp;

    if (this.logEnabled) {
      const sourceDevice = this.devices.get(packet.sourceIp);
      const destDevice = this.devices.get(packet.destIp);
      const packetDetails = {
        timestamp: new Date(packet.timestamp).toISOString(),
        src: `${packet.sourceIp}:${packet.sourcePort}`,
        dst: `${packet.destIp}:${packet.destPort}`,
        protocol: packet.protocol,
        size: packet.size,
        connectionId,
        sourceType: sourceDevice?.type || 'unknown',
        destType: destDevice?.type || 'unknown'
      };
      console.log(`[NetworkAnalysisService] PACKET: ${JSON.stringify(packetDetails)}`);
    }

    const sourceDevice = this.devices.get(packet.sourceIp);
    const destDevice = this.devices.get(packet.destIp);

    if (sourceDevice) {
      sourceDevice.trafficOut += packet.size;
      sourceDevice.lastSeen = packet.timestamp;
    }

    if (destDevice) {
      destDevice.trafficIn += packet.size;
      destDevice.lastSeen = packet.timestamp;
    }

    if (this.logEnabled && connection.packets % 100 === 0) {
      console.log(`[NetworkAnalysisService] Connection stats - ${connectionId}: ${connection.packets} packets, ${connection.traffic} bytes, avg: ${(connection.traffic / connection.packets).toFixed(1)} bytes/packet`);
    }
  }

  private getConnectionId(packet: Packet): string {
    return `${packet.sourceIp}:${packet.sourcePort}-${packet.destIp}:${packet.destPort}-${packet.protocol}`;
  }

  getNetworkState(): NetworkState {
    const DEVICE_TIMEOUT = 300000;
    const CONNECTION_TIMEOUT = 300000;
    const now = Date.now();

    this.collisionCheckCounter++;
    if (this.collisionCheckCounter >= 10) {
      this.resolveAllCollisions();
      this.collisionCheckCounter = 0;
    }

    const allDevices = Array.from(this.devices.values());
    const allConnections = Array.from(this.connections.values());

    const activeDevices = allDevices.filter(
      device => now - device.lastSeen < DEVICE_TIMEOUT
    );

    const activeConnections = allConnections.filter(
      connection => now - connection.lastSeen < CONNECTION_TIMEOUT
    );

    if (this.logEnabled) {
      console.log(`[NetworkAnalysisService] Network state: ${activeDevices.length} active devices, ${activeConnections.length} active connections`);

      if (activeDevices.length > 0) {
        console.log(`[NetworkAnalysisService] ========== ACTIVE DEVICES ==========`);
        activeDevices.forEach(device => {
          console.log(`[NetworkAnalysisService]   Device: ${device.ip}`);
          console.log(`[NetworkAnalysisService]     Type: ${device.type}`);
          console.log(`[NetworkAnalysisService]     MAC: ${device.mac || 'N/A'}`);
          console.log(`[NetworkAnalysisService]     Position: (${device.x.toFixed(0)}, ${device.y.toFixed(0)})`);
          console.log(`[NetworkAnalysisService]     Traffic In: ${device.trafficIn} bytes`);
          console.log(`[NetworkAnalysisService]     Traffic Out: ${device.trafficOut} bytes`);
          console.log(`[NetworkAnalysisService]     Total Traffic: ${device.trafficIn + device.trafficOut} bytes`);
          console.log(`[NetworkAnalysisService]     Last Seen: ${new Date(device.lastSeen).toISOString()}`);
        });
      }

      if (activeConnections.length > 0) {
        console.log(`[NetworkAnalysisService] ========== ACTIVE CONNECTIONS ==========`);
        activeConnections.forEach(connection => {
          console.log(`[NetworkAnalysisService]   Connection: ${connection.id}`);
          console.log(`[NetworkAnalysisService]     Source: ${connection.sourceId}`);
          console.log(`[NetworkAnalysisService]     Dest: ${connection.destId}`);
          console.log(`[NetworkAnalysisService]     Protocol: ${connection.protocol}`);
          console.log(`[NetworkAnalysisService]     Packets: ${connection.packets}`);
          console.log(`[NetworkAnalysisService]     Bytes: ${connection.traffic} bytes`);
          console.log(`[NetworkAnalysisService]     Avg per packet: ${(connection.traffic / connection.packets).toFixed(1)} bytes`);
          console.log(`[NetworkAnalysisService]     Last Seen: ${new Date(connection.lastSeen).toISOString()}`);
        });
      }
    }

    return {
      devices: new Map(activeDevices.map(d => [d.id, d])),
      connections: new Map(activeConnections.map(c => [c.id, c])),
      flows: []
    };
  }

  getDevice(ip: string): NetworkDevice | undefined {
    return this.devices.get(ip);
  }

  getConnection(sourceIp: string, destIp: string, protocol: Protocol): NetworkConnection | undefined {
    for (const [id, connection] of this.connections.entries()) {
      if (connection.sourceId === sourceIp && connection.destId === destIp && connection.protocol === protocol) {
        return connection;
      }
    }
    return undefined;
  }

  getAllDevices(): NetworkDevice[] {
    const devices = Array.from(this.devices.values());
    if (this.logEnabled) {
      console.log(`[NetworkAnalysisService] getAllDevices() returning ${devices.length} devices`);
    }
    return devices;
  }

  getAllConnections(): NetworkConnection[] {
    const connections = Array.from(this.connections.values());
    if (this.logEnabled) {
      console.log(`[NetworkAnalysisService] getAllConnections() returning ${connections.length} connections`);
    }
    return connections;
  }

  clear(): void {
    if (this.logEnabled) {
      console.log('[NetworkAnalysisService] Clearing all devices and connections');
    }
    this.devices.clear();
    this.connections.clear();
  }
}
