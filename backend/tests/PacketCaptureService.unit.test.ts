import { describe, test, expect } from '@jest/globals';
import { PacketCaptureService } from '../src/services/PacketCaptureService';

class TestablePacketCaptureService extends PacketCaptureService {
  public testParseTcpdumpLine(line: string) {
    return (this as any)['parseTcpdumpLine'](line);
  }
}

describe('PacketCaptureService - Unit Tests', () => {
  let service: TestablePacketCaptureService;

  beforeEach(() => {
    service = new TestablePacketCaptureService(false);
  });

  describe('Packet Parsing - TCP', () => {
    test('should parse basic TCP packet', () => {
      const line = 'IP 192.168.1.1.80 > 192.168.1.2.54321: Flags [S], seq 0, win 65535, length 0';
      const packet = service.testParseTcpdumpLine(line);

      expect(packet).not.toBeNull();
      expect(packet?.sourceIp).toBe('192.168.1.1');
      expect(packet?.sourcePort).toBe(80);
      expect(packet?.destIp).toBe('192.168.1.2');
      expect(packet?.destPort).toBe(54321);
      expect(packet?.protocol).toBe('TCP');
    });

    test('should parse TCP packet with length', () => {
      const line = 'IP 192.168.1.1.80 > 192.168.1.2.54321: Flags [P.], seq 1:1025, ack 1, win 65535, length 1024';
      const packet = service.testParseTcpdumpLine(line);

      expect(packet).not.toBeNull();
      expect(packet?.size).toBe(1024);
      expect(packet?.protocol).toBe('TCP');
    });

    test('should parse TCP packet with MAC addresses (ethertype format)', () => {
      const line = 'aa:bb:cc:dd:ee:ff > 11:22:33:44:55:66, ethertype IPv4 (0x0800), length 74: IP 192.168.1.1.80 > 192.168.1.2.54321: Flags [S], seq 0, win 65535, length 0';
      const packet = service.testParseTcpdumpLine(line);

      expect(packet).not.toBeNull();
      expect(packet?.sourceIp).toBe('192.168.1.1');
      expect(packet?.destIp).toBe('192.168.1.2');
      expect(packet?.info).toContain('aa:bb:cc:dd:ee:ff');
      expect(packet?.info).toContain('11:22:33:44:55:66');
    });

    test('should parse TCP packet with MAC addresses (no ethertype format)', () => {
      const line = 'e4:c7:67:60:ed:57 > 00:1b:21:95:54:d1, IPv4, length 1466: 162.159.135.234.443 > 192.168.1.21.54980: tcp 1400';
      const packet = service.testParseTcpdumpLine(line);

      expect(packet).not.toBeNull();
      expect(packet?.sourceIp).toBe('162.159.135.234');
      expect(packet?.destIp).toBe('192.168.1.21');
      expect(packet?.sourcePort).toBe(443);
      expect(packet?.destPort).toBe(54980);
      expect(packet?.info).toContain('e4:c7:67:60:ed:57');
      expect(packet?.info).toContain('00:1b:21:95:54:d1');
    });

    test('should parse TCP packet with explicit length field', () => {
      const line = 'IP 192.168.1.1.443 > 192.168.1.2.54322: Flags [S], seq 0, win 65535, length 1500';
      const packet = service.testParseTcpdumpLine(line);

      expect(packet).not.toBeNull();
      expect(packet?.size).toBe(1500);
    });
  });

  describe('Packet Parsing - UDP', () => {
    test('should parse basic UDP packet', () => {
      const line = 'IP 192.168.1.1.12345 > 192.168.1.2.54321: UDP, length 512';
      const packet = service.testParseTcpdumpLine(line);

      expect(packet).not.toBeNull();
      expect(packet?.sourceIp).toBe('192.168.1.1');
      expect(packet?.sourcePort).toBe(12345);
      expect(packet?.destIp).toBe('192.168.1.2');
      expect(packet?.destPort).toBe(54321);
      expect(packet?.protocol).toBe('UDP');
      expect(packet?.size).toBe(512);
    });

    test('should parse UDP DNS packet', () => {
      const line = 'IP 10.0.0.1.53 > 192.168.1.1.54321: UDP, length 1024';
      const packet = service.testParseTcpdumpLine(line);

      expect(packet).not.toBeNull();
      expect(packet?.sourceIp).toBe('10.0.0.1');
      expect(packet?.sourcePort).toBe(53);
      expect(packet?.protocol).toBe('DNS');
    });
  });

  describe('Packet Parsing - ICMP', () => {
    test('should parse ICMP packet', () => {
      const line = 'IP 192.168.1.1 > 192.168.1.2: ICMP echo request, id 12345, seq 0, length 64';
      const packet = service.testParseTcpdumpLine(line);

      expect(packet).not.toBeNull();
      expect(packet?.sourceIp).toBe('192.168.1.1');
      expect(packet?.destIp).toBe('192.168.1.2');
      expect(packet?.protocol).toBe('ICMP');
      expect(packet?.size).toBe(64);
    });
  });

  describe('Protocol Detection by Port', () => {
    test('should detect HTTP (port 80)', () => {
      const line = 'IP 192.168.1.1.80 > 192.168.1.2.54321: Flags [S], length 0';
      const packet = service.testParseTcpdumpLine(line);
      expect(packet?.protocol).toBe('HTTP');
    });

    test('should detect HTTPS (port 443)', () => {
      const line = 'IP 192.168.1.1.443 > 192.168.1.2.54321: Flags [S], length 0';
      const packet = service.testParseTcpdumpLine(line);
      expect(packet?.protocol).toBe('HTTPS');
    });

    test('should detect DNS (port 53)', () => {
      const line = 'IP 10.0.0.1.53 > 192.168.1.1.54321: UDP, length 512';
      const packet = service.testParseTcpdumpLine(line);
      expect(packet?.protocol).toBe('DNS');
    });
  });

  describe('Edge Cases', () => {
    test('should return null for empty string', () => {
      const packet = service.testParseTcpdumpLine('');
      expect(packet).toBeNull();
    });

    test('should return null for whitespace only', () => {
      const packet = service.testParseTcpdumpLine('   ');
      expect(packet).toBeNull();
    });

    test('should return null for invalid line', () => {
      const packet = service.testParseTcpdumpLine('invalid packet data');
      expect(packet).toBeNull();
    });

    test('should return null for packet with 0.0.0.0 source', () => {
      const line = 'IP 0.0.0.0.68 > 255.255.255.255.67: UDP, length 512';
      const packet = service.testParseTcpdumpLine(line);
      expect(packet).toBeNull();
    });
  });
});
