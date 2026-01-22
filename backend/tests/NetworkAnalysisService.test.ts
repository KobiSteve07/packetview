import { describe, test, expect, beforeEach } from '@jest/globals';
import { NetworkAnalysisService } from '../src/services/NetworkAnalysisService';
import { Packet, Protocol, DeviceType } from '../src/shared/types';

describe('NetworkAnalysisService', () => {
  let service: NetworkAnalysisService;

  beforeEach(() => {
    service = new NetworkAnalysisService(false);
  });

  describe('Device Discovery', () => {
    test('should discover a new device from source IP', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024,
        info: 'MAC: aa:bb:cc:dd:ee:ff -> 11:22:33:44:55:66'
      };

      service.analyzePacket(packet);

      const sourceDevice = service.getDevice('192.168.1.1');
      expect(sourceDevice).toBeDefined();
      expect(sourceDevice?.ip).toBe('192.168.1.1');
      expect(sourceDevice?.type).toBe(DeviceType.GATEWAY);
      expect(sourceDevice?.mac).toBe('aa:bb:cc:dd:ee:ff');
      expect(sourceDevice?.trafficOut).toBe(1024);
    });

    test('should discover a new device from destination IP', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024,
        info: 'MAC: aa:bb:cc:dd:ee:ff -> 11:22:33:44:55:66'
      };

      service.analyzePacket(packet);

      const destDevice = service.getDevice('192.168.1.2');
      expect(destDevice).toBeDefined();
      expect(destDevice?.ip).toBe('192.168.1.2');
      expect(destDevice?.type).toBe(DeviceType.HOST);
      expect(destDevice?.mac).toBe('11:22:33:44:55:66');
      expect(destDevice?.trafficIn).toBe(1024);
    });

    test('should detect gateway devices (.1 addresses)', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.100',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 512
      };

      service.analyzePacket(packet);

      const device = service.getDevice('192.168.1.1');
      expect(device?.type).toBe(DeviceType.GATEWAY);
    });

    test('should detect host devices (non-.1 addresses)', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.100',
        destIp: '192.168.1.1',
        sourcePort: 54321,
        destPort: 80,
        protocol: Protocol.TCP,
        size: 512
      };

      service.analyzePacket(packet);

      const device = service.getDevice('192.168.1.100');
      expect(device?.type).toBe(DeviceType.HOST);
    });

    test('should skip broadcast addresses (255.255.255.255)', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '255.255.255.255',
        sourcePort: 68,
        destPort: 67,
        protocol: Protocol.UDP,
        size: 512
      };

      service.analyzePacket(packet);

      const devices = service.getAllDevices();
      expect(devices.length).toBe(1);
      expect(devices[0].ip).toBe('192.168.1.1');
    });

    test('should skip multicast addresses (224.0.0.1)', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '224.0.0.1',
        sourcePort: 123,
        destPort: 123,
        protocol: Protocol.UDP,
        size: 512
      };

      service.analyzePacket(packet);

      const devices = service.getAllDevices();
      expect(devices.length).toBe(1);
      expect(devices[0].ip).toBe('192.168.1.1');
    });

    test('should skip localhost addresses (127.0.0.1)', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '127.0.0.1',
        destIp: '192.168.1.1',
        sourcePort: 54321,
        destPort: 80,
        protocol: Protocol.TCP,
        size: 512
      };

      service.analyzePacket(packet);

      const device = service.getDevice('127.0.0.1');
      expect(device).toBeUndefined();

      const devices = service.getAllDevices();
      expect(devices.length).toBe(1);
    });

    test('should track multiple devices correctly', () => {
      const packets: Packet[] = [
        {
          timestamp: Date.now(),
          sourceIp: '192.168.1.1',
          destIp: '192.168.1.2',
          sourcePort: 80,
          destPort: 54321,
          protocol: Protocol.TCP,
          size: 1024
        },
        {
          timestamp: Date.now(),
          sourceIp: '192.168.1.3',
          destIp: '192.168.1.1',
          sourcePort: 22,
          destPort: 12345,
          protocol: Protocol.SSH,
          size: 512
        },
        {
          timestamp: Date.now(),
          sourceIp: '192.168.1.2',
          destIp: '192.168.1.3',
          sourcePort: 443,
          destPort: 54322,
          protocol: Protocol.HTTPS,
          size: 2048
        }
      ];

      packets.forEach(p => service.analyzePacket(p));

      const devices = service.getAllDevices();
      expect(devices.length).toBe(3);

      const ips = devices.map(d => d.ip).sort();
      expect(ips).toEqual(['192.168.1.1', '192.168.1.2', '192.168.1.3']);
    });

    test('should update device traffic correctly', () => {
      const packet1: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024
      };

      const packet2: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.2',
        destIp: '192.168.1.1',
        sourcePort: 54321,
        destPort: 80,
        protocol: Protocol.TCP,
        size: 512
      };

      service.analyzePacket(packet1);
      service.analyzePacket(packet2);

      const device1 = service.getDevice('192.168.1.1');
      const device2 = service.getDevice('192.168.1.2');

      expect(device1?.trafficIn).toBe(512);
      expect(device1?.trafficOut).toBe(1024);
      expect(device2?.trafficIn).toBe(1024);
      expect(device2?.trafficOut).toBe(512);
    });
  });

  describe('Connection Tracking', () => {
    test('should create a new connection', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024
      };

      service.analyzePacket(packet);

      const connection = service.getConnection('192.168.1.1', '192.168.1.2', Protocol.TCP);
      expect(connection).toBeDefined();
      expect(connection?.sourceId).toBe('192.168.1.1');
      expect(connection?.destId).toBe('192.168.1.2');
      expect(connection?.protocol).toBe(Protocol.TCP);
      expect(connection?.packets).toBe(1);
      expect(connection?.traffic).toBe(1024);
    });

    test('should update existing connection', () => {
      const packet1: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024
      };

      const packet2: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 512
      };

      service.analyzePacket(packet1);
      service.analyzePacket(packet2);

      const connection = service.getConnection('192.168.1.1', '192.168.1.2', Protocol.TCP);
      expect(connection?.packets).toBe(2);
      expect(connection?.traffic).toBe(1536);
    });

    test('should track multiple connections', () => {
      const packets: Packet[] = [
        {
          timestamp: Date.now(),
          sourceIp: '192.168.1.1',
          destIp: '192.168.1.2',
          sourcePort: 80,
          destPort: 54321,
          protocol: Protocol.TCP,
          size: 1024
        },
        {
          timestamp: Date.now(),
          sourceIp: '192.168.1.1',
          destIp: '192.168.1.3',
          sourcePort: 443,
          destPort: 54322,
          protocol: Protocol.HTTPS,
          size: 2048
        }
      ];

      packets.forEach(p => service.analyzePacket(p));

      const connections = service.getAllConnections();
      expect(connections.length).toBe(2);
    });

    test('should distinguish connections by port', () => {
      const packets: Packet[] = [
        {
          timestamp: Date.now(),
          sourceIp: '192.168.1.1',
          destIp: '192.168.1.2',
          sourcePort: 80,
          destPort: 54321,
          protocol: Protocol.TCP,
          size: 1024
        },
        {
          timestamp: Date.now(),
          sourceIp: '192.168.1.1',
          destIp: '192.168.1.2',
          sourcePort: 443,
          destPort: 54322,
          protocol: Protocol.TCP,
          size: 2048
        }
      ];

      packets.forEach(p => service.analyzePacket(p));

      const connections = service.getAllConnections();
      expect(connections.length).toBe(2);

      const port80Conn = connections.find(c => c.id.includes(':80'));
      const port443Conn = connections.find(c => c.id.includes(':443'));

      expect(port80Conn).toBeDefined();
      expect(port443Conn).toBeDefined();
      expect(port80Conn?.traffic).toBe(1024);
      expect(port443Conn?.traffic).toBe(2048);
    });
  });

  describe('Network State', () => {
    test('should return network state with active devices', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024
      };

      service.analyzePacket(packet);

      const state = service.getNetworkState();

      expect(state.devices.size).toBe(2);
      expect(state.connections.size).toBe(1);
      expect(Array.from(state.devices.keys())).toContain('192.168.1.1');
      expect(Array.from(state.devices.keys())).toContain('192.168.1.2');
    });

    test('should filter out inactive devices', () => {
      const oldTimestamp = Date.now() - 400000; // 6 minutes ago
      const packet: Packet = {
        timestamp: oldTimestamp,
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024
      };

      service.analyzePacket(packet);

      const state = service.getNetworkState();

      expect(state.devices.size).toBe(0);
    });

    test('should filter out inactive connections', () => {
      const oldTimestamp = Date.now() - 600000; // 10 minutes ago (longer than timeout)
      const packet: Packet = {
        timestamp: oldTimestamp,
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024
      };

      service.analyzePacket(packet);

      const state = service.getNetworkState();

      expect(state.connections.size).toBe(0);
    });

    test('should include recently active devices', () => {
      const recentTimestamp = Date.now() - 10000; // 10 seconds ago
      const packet: Packet = {
        timestamp: recentTimestamp,
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024
      };

      service.analyzePacket(packet);

      const state = service.getNetworkState();

      expect(state.devices.size).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    test('should handle packets with zero size', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 0
      };

      service.analyzePacket(packet);

      const device = service.getDevice('192.168.1.1');
      expect(device?.trafficOut).toBe(0);
    });

    test('should handle packets with large size', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 65536
      };

      service.analyzePacket(packet);

      const device = service.getDevice('192.168.1.1');
      expect(device?.trafficOut).toBe(65536);
    });

    test('should handle different address families (10.x, 172.x)', () => {
      const packets: Packet[] = [
        {
          timestamp: Date.now(),
          sourceIp: '10.0.0.1',
          destIp: '10.0.0.2',
          sourcePort: 80,
          destPort: 54321,
          protocol: Protocol.TCP,
          size: 1024
        },
        {
          timestamp: Date.now(),
          sourceIp: '172.16.0.2',
          destIp: '172.16.0.3',
          sourcePort: 443,
          destPort: 54322,
          protocol: Protocol.HTTPS,
          size: 2048
        }
      ];

      packets.forEach(p => service.analyzePacket(p));

      const devices = service.getAllDevices();
      expect(devices.length).toBe(4);

      const dev10 = devices.find(d => d.ip === '10.0.0.1');
      const dev172 = devices.find(d => d.ip === '172.16.0.2');

      expect(dev10?.type).toBe(DeviceType.GATEWAY);
      expect(dev172?.type).toBe(DeviceType.HOST);
    });

    test('should update MAC address if initially missing', () => {
      const packet1: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024
      };

      const packet2: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024,
        info: 'MAC: aa:bb:cc:dd:ee:ff -> 11:22:33:44:55:66'
      };

      service.analyzePacket(packet1);
      service.analyzePacket(packet2);

      const device = service.getDevice('192.168.1.1');
      expect(device?.mac).toBe('aa:bb:cc:dd:ee:ff');
    });
  });

  describe('Clear Functionality', () => {
    test('should clear all devices and connections', () => {
      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp: '192.168.1.1',
        destIp: '192.168.1.2',
        sourcePort: 80,
        destPort: 54321,
        protocol: Protocol.TCP,
        size: 1024
      };

      service.analyzePacket(packet);
      service.clear();

      expect(service.getAllDevices().length).toBe(0);
      expect(service.getAllConnections().length).toBe(0);
    });
  });
});
