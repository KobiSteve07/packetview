import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { Packet, InterfaceInfo } from '../shared/types';

interface CaptureProcess {
  process: ChildProcess;
  interface: string;
  filter?: string;
  packetCount: number;
}

export class PacketCaptureService extends EventEmitter {
  private captureProcesses: Map<string, CaptureProcess> = new Map();
  private logEnabled: boolean;
  private totalPacketCount: number = 0;

  constructor(logEnabled: boolean = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    super();
    this.logEnabled = logEnabled;
  }

  async getInterfaces(): Promise<InterfaceInfo[]> {
    return new Promise((resolve, reject) => {
      const ipCommand = spawn('ip', ['addr', 'show']);
      let output = '';
      let errorOutput = '';

      ipCommand.stdout.on('data', (data) => {
        output += data.toString();
      });

      ipCommand.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ipCommand.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to get interfaces: ${errorOutput}`));
          return;
        }

        const interfaces = this.parseIpOutput(output);
        resolve(interfaces);
      });
    });
  }

  async start(interfaceName: string, filter?: string): Promise<void> {
    console.log('PacketCaptureService.start() called:', { interfaceName, filter });
    console.log('Current capturing state:', this.getCaptureStatus());

    if (this.captureProcesses.has(interfaceName)) {
      throw new Error(`Capture already in progress on interface ${interfaceName}`);
    }

    const TCPDUMP_FLAGS = {
      INTERFACE: '-i',
      NO_HOSTNAME_RESOLUTION: '-n',
      LINE_BUFFERED: '-l',
      NO_TIMESTAMP: '-t',
      QUIET: '-q',
      SHOW_MAC: '-e'
    };

    const tcpdumpArgs = [
      TCPDUMP_FLAGS.INTERFACE, interfaceName,
      TCPDUMP_FLAGS.NO_HOSTNAME_RESOLUTION,
      TCPDUMP_FLAGS.LINE_BUFFERED,
      TCPDUMP_FLAGS.NO_TIMESTAMP,
      TCPDUMP_FLAGS.QUIET,
      TCPDUMP_FLAGS.SHOW_MAC
    ];

    if (filter) {
      tcpdumpArgs.push(filter);
    }

    console.log('Spawning tcpdump with args:', tcpdumpArgs);

    const captureProcess = spawn('tcpdump', tcpdumpArgs);
    const processInfo: CaptureProcess = {
      process: captureProcess,
      interface: interfaceName,
      filter,
      packetCount: 0
    };

    this.captureProcesses.set(interfaceName, processInfo);

    captureProcess.on('error', (error) => {
      this.emit('error', new Error(`Failed to start tcpdump on ${interfaceName}: ${error.message}`));
      this.stopInterface(interfaceName);
    });

    captureProcess.stderr?.on('data', (data) => {
      const errorMsg = data.toString();

      const isInfoMessage =
        errorMsg.includes('tcpdump: listening on') ||
        errorMsg.includes('tcpdump: verbose output suppressed') ||
        errorMsg.includes('listening on') ||
        errorMsg.includes('packets captured') ||
        errorMsg.includes('packets received by filter') ||
        errorMsg.includes('packets dropped by kernel');

      if (!isInfoMessage && errorMsg.trim()) {
        console.error('[PacketCaptureService] tcpdump stderr:', errorMsg);
        this.emit('error', new Error(errorMsg));
      }
    });

    captureProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          const packet = this.parseTcpdumpLine(trimmedLine);
          if (packet) {
            // Add interface identifier to packet
            packet.interface = interfaceName;
            
            processInfo.packetCount++;
            this.totalPacketCount++;
            
            if (this.logEnabled && this.totalPacketCount % 100 === 0) {
              console.log(`[PacketCaptureService] Processed ${this.totalPacketCount} packets total across ${this.captureProcesses.size} interfaces`);
            }
            if (this.logEnabled) {
              console.log(`[PacketCaptureService] Packet captured on ${interfaceName}: ${packet.sourceIp}:${packet.sourcePort} -> ${packet.destIp}:${packet.destPort} (${packet.protocol}, ${packet.size} bytes)`);
            }
            this.emit('packet', packet);
          } else if (this.logEnabled) {
            console.log(`[PacketCaptureService] Failed to parse tcpdump line on ${interfaceName}: ${trimmedLine}`);
          }
        }
      }
    });

    captureProcess.on('close', (code) => {
      this.captureProcesses.delete(interfaceName);
      if (code !== 0 && code !== null) {
        this.emit('error', new Error(`tcpdump on ${interfaceName} exited with code ${code}`));
      }
      if (this.logEnabled) {
        console.log(`[PacketCaptureService] Capture stopped on ${interfaceName}. Remaining active interfaces: ${this.captureProcesses.size}`);
      }
    });

    if (this.logEnabled) {
      console.log(`[PacketCaptureService] Capture started successfully on ${interfaceName}. Active interfaces: ${this.captureProcesses.size}`);
    }
  }

  stop(): void {
    this.stopAllInterfaces();
  }

  stopInterface(interfaceName: string): void {
    const processInfo = this.captureProcesses.get(interfaceName);
    if (!processInfo) {
      if (this.logEnabled) {
        console.log(`[PacketCaptureService] No capture process to stop on interface ${interfaceName}`);
      }
      return;
    }

    if (this.logEnabled) {
      console.log(`[PacketCaptureService] Stopping capture on interface ${interfaceName}. Packets captured: ${processInfo.packetCount}`);
    }

    processInfo.process.kill('SIGTERM');
    this.captureProcesses.delete(interfaceName);

    if (this.logEnabled) {
      console.log(`[PacketCaptureService] Capture stopped on ${interfaceName}. Remaining active interfaces: ${this.captureProcesses.size}`);
    }
  }

  stopAllInterfaces(): void {
    if (this.logEnabled) {
      console.log(`[PacketCaptureService] stopAllInterfaces() called. Active interfaces: ${this.captureProcesses.size}`);
      console.log(`[PacketCaptureService] Total packets captured in this session: ${this.totalPacketCount}`);
    }

    if (this.captureProcesses.size === 0) {
      if (this.logEnabled) {
        console.log('[PacketCaptureService] No capture processes to stop');
      }
      return;
    }

    for (const [interfaceName, processInfo] of this.captureProcesses) {
      if (this.logEnabled) {
        console.log(`[PacketCaptureService] Killing capture process on ${interfaceName} with SIGTERM`);
      }
      processInfo.process.kill('SIGTERM');
    }

    this.captureProcesses.clear();
    this.totalPacketCount = 0;

    if (this.logEnabled) {
      console.log('[PacketCaptureService] All capture processes stopped');
    }
  }

  isCapturingActive(): boolean {
    return this.captureProcesses.size > 0;
  }

  getCaptureStatus(): { active: boolean; interfaces: Array<{ name: string; packetCount: number; filter?: string }> } {
    const interfaces = Array.from(this.captureProcesses.entries()).map(([name, process]) => ({
      name,
      packetCount: process.packetCount,
      filter: process.filter
    }));

    return {
      active: this.captureProcesses.size > 0,
      interfaces
    };
  }

  getActiveInterfaces(): string[] {
    return Array.from(this.captureProcesses.keys());
  }

  async startMultiple(interfaceNames: string[], filter?: string): Promise<void> {
    console.log('PacketCaptureService.startMultiple() called:', { interfaceNames, filter });

    if (interfaceNames.length === 0) {
      throw new Error('At least one interface must be specified');
    }

    // Check for duplicates
    const duplicateInterfaces = interfaceNames.filter(name => this.captureProcesses.has(name));
    if (duplicateInterfaces.length > 0) {
      throw new Error(`Capture already in progress on interfaces: ${duplicateInterfaces.join(', ')}`);
    }

    // Start capture on each interface
    const startPromises = interfaceNames.map(interfaceName => 
      this.start(interfaceName, filter).catch(error => {
        // If one interface fails, stop all that were started
        this.stopAllInterfaces();
        throw new Error(`Failed to start capture on ${interfaceName}: ${error.message}`);
      })
    );

    await Promise.all(startPromises);

    if (this.logEnabled) {
      console.log(`[PacketCaptureService] Multi-interface capture started successfully on ${interfaceNames.length} interfaces`);
    }
  }

  private parseIpOutput(output: string): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = [];
    const lines = output.split('\n');
    let currentInterface: Partial<InterfaceInfo> | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      const interfaceMatch = trimmedLine.match(/^\d+:\s+([a-zA-Z0-9@]+):/);
      if (interfaceMatch) {
        if (currentInterface && currentInterface.name) {
          interfaces.push({
            name: currentInterface.name,
            description: 'Network Interface',
            ip: currentInterface.ip,
            isUp: currentInterface.isUp ?? false
          });
        }
        const name = interfaceMatch[1].split('@')[0];
        const isUp = trimmedLine.includes('<UP') || trimmedLine.includes('<BROADCAST');
        currentInterface = { name, isUp };
        continue;
      }

      if (currentInterface) {
        const ipv4Match = trimmedLine.match(/inet\s+([0-9.]+)/);
        if (ipv4Match && !currentInterface.ip) {
          currentInterface.ip = ipv4Match[1];
        }
      }
    }

    if (currentInterface && currentInterface.name) {
      interfaces.push({
        name: currentInterface.name,
        description: 'Network Interface',
        ip: currentInterface.ip,
        isUp: currentInterface.isUp ?? false
      });
    }

    return interfaces;
  }

  private parseTcpdumpLine(line: string): Packet | null {
    if (!line || line.trim() === '') {
      return null;
    }

    if (line.includes('0.0.0.0.') || line.includes(' > 0.0.0.0.')) {
      return null;
    }

    try {
      let ipLine = line;
      let info = '';

      const macMatch = line.match(/^([a-fA-F0-9:]{17})\s*>\s*([a-fA-F0-9:]{17}),/);
      if (macMatch) {
        info = `MAC: ${macMatch[1]} -> ${macMatch[2]}`;
        const ipv4Index = line.indexOf('IPv4,');
        if (ipv4Index !== -1) {
          ipLine = line.substring(ipv4Index + 6);
        } else {
          const ipIndex = line.indexOf('IP ');
          if (ipIndex !== -1) {
            ipLine = line.substring(ipIndex);
          }
        }
      }

      const ipPortMatch = ipLine.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\.?(\d*)\s*>\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\.?(\d*):/);
      if (!ipPortMatch) {
        return null;
      }

      const sourceIp = ipPortMatch[1];
      let sourcePort = parseInt(ipPortMatch[2] || '0', 10);
      const destIp = ipPortMatch[3];
      let destPort = parseInt(ipPortMatch[4] || '0', 10);

      let protocol: string = 'TCP';
      let size = 0;

      if (ipLine.includes('UDP')) {
        protocol = 'UDP';
        const lengthMatch = ipLine.match(/length\s+(\d+)/);
        if (lengthMatch) {
          size = parseInt(lengthMatch[1], 10);
        }
      } else if (ipLine.includes('ICMP')) {
        protocol = 'ICMP';
        const lengthMatch = ipLine.match(/length\s+(\d+)/);
        if (lengthMatch) {
          size = parseInt(lengthMatch[1], 10);
        }
        sourcePort = 0;
        destPort = 0;
      } else if (ipLine.includes('Flags')) {
        protocol = 'TCP';
        const lengthMatch = ipLine.match(/length\s+(\d+)/);
        if (lengthMatch) {
          size = parseInt(lengthMatch[1], 10);
        }

        if (sourcePort === 80 && !ipLine.includes('seq') && !ipLine.includes('ack')) {
          protocol = 'HTTP';
        } else if (sourcePort === 443 && !ipLine.includes('seq') && !ipLine.includes('ack')) {
          protocol = 'HTTPS';
        } else if (sourcePort === 22) {
          protocol = 'SSH';
        }
      }

      if (protocol === 'UDP' && (sourcePort === 53 || destPort === 53)) {
        protocol = 'DNS';
      }

      const packet: Packet = {
        timestamp: Date.now(),
        sourceIp,
        destIp,
        sourcePort,
        destPort,
        protocol: protocol as any,
        size,
        info: info || undefined
      };

      return packet;
    } catch (error) {
      if (this.logEnabled) {
        console.error(`[PacketCaptureService] Error parsing tcpdump line: ${line}`, error);
      }
      return null;
    }
  }
}
