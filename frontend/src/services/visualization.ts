import * as Types from '../types';

const PROTOCOL_COLORS: Record<Types.Protocol, string> = {
  'TCP': '#4a9eff',
  'UDP': '#9eff4a',
  'ICMP': '#ff4a4a',
  'HTTP': '#ff9e4a',
  'HTTPS': '#4aff9e',
  'DNS': '#ff4a9e',
  'SSH': '#9e4aff',
  'FTP': '#4a9eff',
  'SMTP': '#ff9e4a',
  'OTHER': '#888888'
};

export interface PacketAnimation {
  connectionId: string;
  progress: number;
  protocol: Types.Protocol;
  timestamp: number;
}

export class VisualizationService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private devices: Map<string, Types.NetworkDevice>;
  private connections: Map<string, Types.NetworkConnection>;
  private packetAnimations: PacketAnimation[];
  private localIp: string | null = null;
  private showPacketAnimations: boolean = true;
  private filters: Types.FilterOptions = {
    ip: '',
    ipType: 'all',
    protocol: 'all'
  };

  // Pan state
  private panOffsetX: number = 0;
  private panOffsetY: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragStartOffsetX: number = 0;
  private dragStartOffsetY: number = 0;

  // Zoom state
  private zoomScale: number = 1;
  private minZoom: number = 0.1;
  private maxZoom: number = 5;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
    this.devices = new Map();
    this.connections = new Map();
    this.packetAnimations = [];

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.setupPanZoomHandlers();
  }

  private resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (container) {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
    }
  }

  private setupPanZoomHandlers(): void {
    // Pan handlers (mouse drag)
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left mouse button
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartOffsetX = this.panOffsetX;
        this.dragStartOffsetY = this.panOffsetY;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.panOffsetX = this.dragStartOffsetX + dx;
        this.panOffsetY = this.dragStartOffsetY + dy;
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
      }
    });

    this.canvas.style.cursor = 'grab';

    // Zoom handler (mouse wheel)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate world coordinates before zoom
      const worldX = (mouseX - this.panOffsetX) / this.zoomScale;
      const worldY = (mouseY - this.panOffsetY) / this.zoomScale;

      // Apply zoom
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoomScale = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomScale * zoomFactor));

      // Adjust pan to zoom toward mouse position
      this.panOffsetX = mouseX - worldX * newZoomScale;
      this.panOffsetY = mouseY - worldY * newZoomScale;
      this.zoomScale = newZoomScale;
    }, { passive: false });
  }

  resetView(): void {
    this.panOffsetX = 0;
    this.panOffsetY = 0;
    this.zoomScale = 1;
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.panOffsetX) / this.zoomScale,
      y: (screenY - this.panOffsetY) / this.zoomScale
    };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoomScale + this.panOffsetX,
      y: worldY * this.zoomScale + this.panOffsetY
    };
  }

  getZoomScale(): number {
    return this.zoomScale;
  }

  getPanOffset(): { x: number; y: number } {
    return { x: this.panOffsetX, y: this.panOffsetY };
  }

  updateNetworkState(devices: Types.NetworkDevice[], connections: Types.NetworkConnection[]): void {
    this.devices.clear();
    devices.forEach(device => {
      this.devices.set(device.id, device);
    });

    this.connections.clear();
    connections.forEach(connection => {
      this.connections.set(connection.id, connection);
    });
  }

  addPacketAnimation(connectionId: string, protocol: Types.Protocol): void {
    if (this.packetAnimations.length > 50) {
      return;
    }
    this.packetAnimations.push({
      connectionId,
      progress: 0,
      protocol,
      timestamp: Date.now()
    });
  }

  render(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.translate(this.panOffsetX, this.panOffsetY);
    this.ctx.scale(this.zoomScale, this.zoomScale);

    this.drawGrid();
    this.drawConnections();
    this.drawPackets();
    this.drawDevices();

    this.ctx.restore();

    requestAnimationFrame(() => this.render());
  }

  private drawGrid(): void {
    const gridSize = 50;
    this.ctx.strokeStyle = '#1a1a1a';
    this.ctx.lineWidth = 1 / this.zoomScale;

    const visibleLeft = -this.panOffsetX / this.zoomScale;
    const visibleTop = -this.panOffsetY / this.zoomScale;
    const visibleRight = visibleLeft + this.canvas.width / this.zoomScale;
    const visibleBottom = visibleTop + this.canvas.height / this.zoomScale;

    const startX = Math.floor(visibleLeft / gridSize) * gridSize;
    const startY = Math.floor(visibleTop / gridSize) * gridSize;

    for (let x = startX; x <= visibleRight; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, visibleTop);
      this.ctx.lineTo(x, visibleBottom);
      this.ctx.stroke();
    }

    for (let y = startY; y <= visibleBottom; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(visibleLeft, y);
      this.ctx.lineTo(visibleRight, y);
      this.ctx.stroke();
    }
  }

  private drawPackets(): void {
    if (!this.showPacketAnimations) {
      return;
    }

    const ANIMATION_SPEED = 0.02;

    this.packetAnimations = this.packetAnimations.filter(anim => {
      const connection = this.connections.get(anim.connectionId);
      if (!connection) {
        return false;
      }

      const sourceDevice = this.devices.get(connection.sourceId);
      const destDevice = this.devices.get(connection.destId);

      if (!sourceDevice || !destDevice) {
        return false;
      }

      const x = sourceDevice.x + (destDevice.x - sourceDevice.x) * anim.progress;
      const y = sourceDevice.y + (destDevice.y - sourceDevice.y) * anim.progress;

      const color = PROTOCOL_COLORS[anim.protocol] || PROTOCOL_COLORS.OTHER;

      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(x, y, 8, 0, Math.PI * 2);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      anim.progress += ANIMATION_SPEED;

      return anim.progress < 1;
    });
  }

  private drawDevices(): void {
    this.devices.forEach(device => {
      if (this.passesDeviceFilter(device)) {
        this.drawDevice(device);
      }
    });
  }

  private drawConnections(): void {
    this.connections.forEach(connection => {
      const sourceDevice = this.devices.get(connection.sourceId);
      const destDevice = this.devices.get(connection.destId);

      if (sourceDevice && destDevice && this.passesDeviceFilter(sourceDevice) && this.passesDeviceFilter(destDevice)) {
        if (this.filters.protocol !== 'all' && connection.protocol !== this.filters.protocol) {
          return;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(sourceDevice.x, sourceDevice.y);
        this.ctx.lineTo(destDevice.x, destDevice.y);

        const color = PROTOCOL_COLORS[connection.protocol] || PROTOCOL_COLORS.OTHER;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = Math.min(connection.traffic / 1000 + 1, 5);
        this.ctx.stroke();

        this.ctx.fillStyle = color;
        this.ctx.font = '10px Arial';
        this.ctx.fillText(
          `${connection.protocol} (${connection.packets} / ${this.formatBytes(connection.traffic)})`,
          (sourceDevice.x + destDevice.x) / 2,
          (sourceDevice.y + destDevice.y) / 2 - 5
        );
      }
    });
  }

  private passesDeviceFilter(device: Types.NetworkDevice): boolean {
    const { ip, ipType } = this.filters;

    if (ipType === 'local' && !this.isLocalIP(device.ip)) {
      return false;
    }

    if (ipType === 'public' && this.isLocalIP(device.ip)) {
      return false;
    }

    if (ip && !device.ip.includes(ip)) {
      return false;
    }

    return true;
  }

  setFilters(filters: Partial<Types.FilterOptions>): void {
    this.filters = { ...this.filters, ...filters };
  }

  getFilters(): Types.FilterOptions {
    return { ...this.filters };
  }

  private isLocalIP(ip: string): boolean {
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.') || ip.startsWith('169.254.')) {
      return true;
    }

    if (ip.startsWith('172.')) {
      const parts = ip.split('.');
      if (parts.length >= 2) {
        const secondOctet = parseInt(parts[1]);
        return secondOctet >= 16 && secondOctet <= 31;
      }
    }

    return false;
  }

  private drawDevice(device: Types.NetworkDevice): void {
    const baseRadius = 25;
    const trafficBonus = Math.min((device.trafficIn + device.trafficOut) / 10000, 15);
    const radius = baseRadius + trafficBonus;
    const isMyDevice = this.isMyDevice(device);

    if (isMyDevice) {
      const pulseIntensity = (Math.sin(Date.now() / 500) + 1) / 2;
      const glowRadius = radius + 10 + pulseIntensity * 15;

      const glowGradient = this.ctx.createRadialGradient(
        device.x, device.y, radius,
        device.x, device.y, glowRadius
      );
      glowGradient.addColorStop(0, `rgba(100, 255, 150, ${0.4 + pulseIntensity * 0.3})`);
      glowGradient.addColorStop(0.5, `rgba(100, 255, 150, ${0.2 + pulseIntensity * 0.15})`);
      glowGradient.addColorStop(1, 'rgba(100, 255, 150, 0)');

      this.ctx.beginPath();
      this.ctx.arc(device.x, device.y, glowRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = glowGradient;
      this.ctx.fill();
    }

    this.ctx.beginPath();
    this.ctx.arc(device.x, device.y, radius, 0, Math.PI * 2);

    const gradient = this.ctx.createRadialGradient(
      device.x, device.y, 0,
      device.x, device.y, radius
    );

    const isLocal = this.isLocalIP(device.ip);
    if (isMyDevice) {
      gradient.addColorStop(0, '#64ff96');
      gradient.addColorStop(1, '#2a8a4a');
    } else if (isLocal) {
      gradient.addColorStop(0, '#4a9eff');
      gradient.addColorStop(1, '#2a2a8a');
    } else {
      gradient.addColorStop(0, '#ff9e4a');
      gradient.addColorStop(1, '#8a2a2a');
    }

    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 11px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(device.ip, device.x, device.y);

    this.ctx.font = '10px Arial';
    this.ctx.fillStyle = '#a0a0a0';
    this.ctx.fillText(
      `In: ${this.formatBytes(device.trafficIn)}`,
      device.x,
      device.y + 15
    );
    this.ctx.fillText(
      `Out: ${this.formatBytes(device.trafficOut)}`,
      device.x,
      device.y + 27
    );
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  getDeviceAtPosition(x: number, y: number): Types.NetworkDevice | null {
    const worldX = (x - this.panOffsetX) / this.zoomScale;
    const worldY = (y - this.panOffsetY) / this.zoomScale;

    for (const device of this.devices.values()) {
      const dx = worldX - device.x;
      const dy = worldY - device.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const baseRadius = 25;
      const trafficBonus = Math.min((device.trafficIn + device.trafficOut) / 10000, 15);
      const radius = baseRadius + trafficBonus;
      if (distance < radius) {
        return device;
      }
    }
    return null;
  }

  start(): void {
    this.render();
  }

  setLocalIp(ip: string): void {
    this.localIp = ip;
  }

  togglePacketAnimations(): boolean {
    this.showPacketAnimations = !this.showPacketAnimations;
    return this.showPacketAnimations;
  }

  private isMyDevice(device: Types.NetworkDevice): boolean {
    return this.localIp !== null && device.ip === this.localIp;
  }
}
