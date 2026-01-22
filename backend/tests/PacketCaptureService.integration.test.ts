import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PacketCaptureService } from '../src/services/PacketCaptureService';

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('PacketCaptureService - Integration Tests', () => {
  let service: PacketCaptureService;
  let mockSpawn: jest.Mock;

  beforeEach(() => {
    service = new PacketCaptureService(false);
    jest.clearAllMocks();
    mockSpawn = require('child_process').spawn as jest.Mock;
  });

  afterEach(() => {
    if (service.isCapturingActive()) {
      service.stop();
    }
  });

  describe('Service Instantiation', () => {
    test('should initialize with logging disabled', () => {
      const testService = new PacketCaptureService(false);
      expect(testService.isCapturingActive()).toBe(false);
    });

    test('should initialize with logging enabled', () => {
      const testService = new PacketCaptureService(true);
      expect(testService.isCapturingActive()).toBe(false);
    });
  });

  describe('Capture State Management', () => {
    test('should track capture active state', () => {
      expect(service.isCapturingActive()).toBe(false);
    });

    test('should update capture state when tcpdump starts', () => {
      const mockProcess = {
        on: jest.fn((event: string, callback: any) => {
          if (event === 'close') {
            callback(0);
          }
        }),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      service.start('eth0');

      expect(service.isCapturingActive()).toBe(true);
    });

    test('should reset capture state when tcpdump stops', () => {
      const mockProcess = {
        on: jest.fn((event: string, callback: any) => {
          if (event === 'close') {
            callback(0);
          }
        }),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      service.start('eth0');
      expect(service.isCapturingActive()).toBe(true);

      service.stop();
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(service.isCapturingActive()).toBe(false);
    });

    test('should handle stop when not capturing', () => {
      const mockProcess = {
        on: jest.fn(),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      service.stop();

      expect(mockProcess.kill).not.toHaveBeenCalled();
      expect(service.isCapturingActive()).toBe(false);
    });
  });

  describe('Event Handling', () => {
    test('should capture start/stop lifecycle', () => {
      const mockProcess = {
        on: jest.fn((event: string, callback: any) => {
          if (event === 'close') {
            callback(0);
          }
        }),
        kill: jest.fn()
      };

      mockSpawn.mockReturnValue(mockProcess as any);

      service.start('eth0');
      expect(service.isCapturingActive()).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('tcpdump', [
        '-i', 'eth0',
        '-n', '-l',
        '-t', '-q',
        '-e'
      ]);

      service.stop();
      expect(service.isCapturingActive()).toBe(false);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});
