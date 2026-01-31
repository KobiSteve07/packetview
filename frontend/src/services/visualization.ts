import * as Types from '../../../shared/types';
import { colorManager } from './ColorManager';

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
    protocol: 'all',
    broadcast: false,
    networkInterface: 'all',
    showLocalDevice: true
  };

  // Pan state
  private panOffsetX: number = 0;
  private panOffsetY: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragStartOffsetX: number = 0;
  private dragStartOffsetY: number = 0;

  private isDraggingDevice: boolean = false;
  private draggedDevice: Types.NetworkDevice | null = null;
  private deviceDragOffsetX: number = 0;
  private deviceDragOffsetY: number = 0;

  private selectedDevices: Set<string> = new Set<string>();
  private isSelecting: boolean = false;
  private selectionStart: { x: number; y: number } | null = null;
  private selectionEnd: { x: number; y: number } | null = null;

  private touchLongPressTimer: number | null = null;
  private LONG_PRESS_THRESHOLD: number = 500;
  private touchMoved: boolean = false;
  private mouseMoved: boolean = false;

  private manuallyPositionedDevices: Set<string> = new Set<string>();

  // Zoom state
  private zoomScale: number = 1;
  private minZoom: number = 0.1;
  private maxZoom: number = 5;

  // Touch state
  private isPinching: boolean = false;
  private initialPinchDistance: number = 0;
  private initialPinchCenter: { x: number; y: number } | null = null;
  private initialPinchWorldCenter: { x: number; y: number } | null = null;
  private initialZoomScale: number = 1;
  private touchPanStartX: number = 0;
  private touchPanStartY: number = 0;
  private touchPanStartOffsetX: number = 0;
  private touchPanStartOffsetY: number = 0;

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
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.mouseMoved = false;

        const clickedDevice = this.getDeviceAtPosition(x, y);

        if (clickedDevice) {
          if (e.ctrlKey) {
            if (this.selectedDevices.has(clickedDevice.id)) {
              this.selectedDevices.delete(clickedDevice.id);
            } else {
              this.selectedDevices.add(clickedDevice.id);
            }
          } else if (!this.selectedDevices.has(clickedDevice.id)) {
            this.selectedDevices.clear();
            this.selectedDevices.add(clickedDevice.id);
          }

          this.isDraggingDevice = true;
          this.draggedDevice = clickedDevice;
          const worldCoords = this.screenToWorld(x, y);
          this.deviceDragOffsetX = worldCoords.x - clickedDevice.x;
          this.deviceDragOffsetY = worldCoords.y - clickedDevice.y;
          this.canvas.style.cursor = 'move';
        } else if (e.ctrlKey) {
          this.isSelecting = true;
          const worldCoords = this.screenToWorld(x, y);
          this.selectionStart = worldCoords;
          this.selectionEnd = worldCoords;
          this.canvas.style.cursor = 'crosshair';
        } else {
          this.isDragging = true;
          this.dragStartX = e.clientX;
          this.dragStartY = e.clientY;
          this.dragStartOffsetX = this.panOffsetX;
          this.dragStartOffsetY = this.panOffsetY;
          this.canvas.style.cursor = 'grabbing';
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingDevice || this.isDragging || this.isSelecting) {
        this.mouseMoved = true;
      }

      if (this.isDraggingDevice && this.draggedDevice) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldCoords = this.screenToWorld(x, y);

        const dx = worldCoords.x - this.deviceDragOffsetX - this.draggedDevice.x;
        const dy = worldCoords.y - this.deviceDragOffsetY - this.draggedDevice.y;

        this.draggedDevice.x = worldCoords.x - this.deviceDragOffsetX;
        this.draggedDevice.y = worldCoords.y - this.deviceDragOffsetY;

        for (const deviceId of this.selectedDevices) {
          if (deviceId !== this.draggedDevice.id) {
            const device = this.devices.get(deviceId);
            if (device) {
              device.x += dx;
              device.y += dy;
              this.notifyDevicePositionChanged(device);
            }
          }
        }

        this.notifyDevicePositionChanged(this.draggedDevice);
      } else if (this.isSelecting && this.selectionStart) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.selectionEnd = this.screenToWorld(x, y);
      } else if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.panOffsetX = this.dragStartOffsetX + dx;
        this.panOffsetY = this.dragStartOffsetY + dy;
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDraggingDevice) {
        for (const deviceId of this.selectedDevices) {
          const device = this.devices.get(deviceId);
          if (device) {
            this.manuallyPositionedDevices.add(device.id);
          }
        }

        this.isDraggingDevice = false;
        this.canvas.style.cursor = 'grab';
        setTimeout(() => {
          this.draggedDevice = null;
        }, 50);
      } else if (this.isSelecting) {
        this.finalizeSelection();
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.canvas.style.cursor = 'grab';
      } else if (this.isDragging) {
        if (!this.mouseMoved) {
          this.selectedDevices.clear();
        }
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.selectedDevices.clear();
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.selectedDevices.clear();
        for (const device of this.devices.values()) {
          if (this.passesDeviceFilter(device)) {
            this.selectedDevices.add(device.id);
          }
        }
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

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        this.touchMoved = false;

        this.touchLongPressTimer = window.setTimeout(() => {
          this.selectedDevices.clear();
          const worldCoords = this.screenToWorld(x, y);
          this.isSelecting = true;
          this.isDragging = false;
          this.selectionStart = worldCoords;
          this.selectionEnd = worldCoords;
          this.canvas.style.cursor = 'crosshair';
        }, this.LONG_PRESS_THRESHOLD);

        const clickedDevice = this.getDeviceAtPosition(x, y);
        if (clickedDevice) {
          if (!this.selectedDevices.has(clickedDevice.id)) {
            this.selectedDevices.clear();
            this.selectedDevices.add(clickedDevice.id);
          }
          this.isDraggingDevice = true;
          this.draggedDevice = clickedDevice;
          const worldCoords = this.screenToWorld(x, y);
          this.deviceDragOffsetX = worldCoords.x - clickedDevice.x;
          this.deviceDragOffsetY = worldCoords.y - clickedDevice.y;
          this.canvas.style.cursor = 'move';
        } else {
          this.isDragging = true;
          this.touchPanStartX = touch.clientX;
          this.touchPanStartY = touch.clientY;
          this.touchPanStartOffsetX = this.panOffsetX;
          this.touchPanStartOffsetY = this.panOffsetY;
          this.canvas.style.cursor = 'grabbing';
        }
      } else if (e.touches.length === 2) {
        this.isPinching = true;
        this.isDragging = false;
        this.isDraggingDevice = false;

        if (this.touchLongPressTimer) {
          clearTimeout(this.touchLongPressTimer);
          this.touchLongPressTimer = null;
        }

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const x1 = touch1.clientX - rect.left;
        const y1 = touch1.clientY - rect.top;
        const x2 = touch2.clientX - rect.left;
        const y2 = touch2.clientY - rect.top;

        this.initialPinchDistance = this.getDistance(x1, y1, x2, y2);
        this.initialPinchCenter = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
        this.initialPinchWorldCenter = {
          x: (this.initialPinchCenter.x - this.panOffsetX) / this.zoomScale,
          y: (this.initialPinchCenter.y - this.panOffsetY) / this.zoomScale
        };
        this.initialZoomScale = this.zoomScale;
        this.canvas.style.cursor = 'grabbing';
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();

      if (this.touchLongPressTimer) {
        clearTimeout(this.touchLongPressTimer);
        this.touchLongPressTimer = null;
      }

      this.touchMoved = true;

      if (this.isSelecting && this.selectionStart && e.touches.length === 1) {
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this.selectionEnd = this.screenToWorld(x, y);
      } else if (this.isDraggingDevice && this.draggedDevice && e.touches.length === 1) {
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const worldCoords = this.screenToWorld(x, y);

        const dx = worldCoords.x - this.deviceDragOffsetX - this.draggedDevice.x;
        const dy = worldCoords.y - this.deviceDragOffsetY - this.draggedDevice.y;

        this.draggedDevice.x = worldCoords.x - this.deviceDragOffsetX;
        this.draggedDevice.y = worldCoords.y - this.deviceDragOffsetY;

        for (const deviceId of this.selectedDevices) {
          if (deviceId !== this.draggedDevice.id) {
            const device = this.devices.get(deviceId);
            if (device) {
              device.x += dx;
              device.y += dy;
              this.notifyDevicePositionChanged(device);
            }
          }
        }

        this.notifyDevicePositionChanged(this.draggedDevice);
      } else if (this.isDragging && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - this.touchPanStartX;
        const dy = touch.clientY - this.touchPanStartY;
        this.panOffsetX = this.touchPanStartOffsetX + dx;
        this.panOffsetY = this.touchPanStartOffsetY + dy;
      } else if (this.isPinching && e.touches.length === 2 && this.initialPinchCenter && this.initialPinchWorldCenter) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const x1 = touch1.clientX - rect.left;
        const y1 = touch1.clientY - rect.top;
        const x2 = touch2.clientX - rect.left;
        const y2 = touch2.clientY - rect.top;

        const currentPinchDistance = this.getDistance(x1, y1, x2, y2);
        const currentPinchCenter = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };

        const zoomFactor = currentPinchDistance / this.initialPinchDistance;
        const newZoomScale = Math.max(this.minZoom, Math.min(this.maxZoom, this.initialZoomScale * zoomFactor));

        this.panOffsetX = currentPinchCenter.x - this.initialPinchWorldCenter.x * newZoomScale;
        this.panOffsetY = currentPinchCenter.y - this.initialPinchWorldCenter.y * newZoomScale;
        this.zoomScale = newZoomScale;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      if (this.touchLongPressTimer) {
        clearTimeout(this.touchLongPressTimer);
        this.touchLongPressTimer = null;
      }

      if (e.touches.length === 0) {
        if (this.isDraggingDevice) {
          for (const deviceId of this.selectedDevices) {
            const device = this.devices.get(deviceId);
            if (device) {
              this.manuallyPositionedDevices.add(device.id);
            }
          }

          this.isDraggingDevice = false;
          this.canvas.style.cursor = 'grab';
          setTimeout(() => {
            this.draggedDevice = null;
          }, 50);
        } else if (this.isSelecting) {
          this.finalizeSelection();
          this.isSelecting = false;
          this.isDragging = false;
          this.selectionStart = null;
          this.selectionEnd = null;
          this.canvas.style.cursor = 'grab';
        } else if (this.isDragging) {
          if (!this.touchMoved) {
            this.selectedDevices.clear();
          }
          this.isDragging = false;
          this.canvas.style.cursor = 'grab';
        } else if (this.isPinching) {
          this.isPinching = false;
          this.initialPinchCenter = null;
          this.initialPinchWorldCenter = null;
          this.canvas.style.cursor = 'grab';
        } else if (!this.touchMoved && !this.isSelecting) {
          this.selectedDevices.clear();
        }
      } else if (e.touches.length === 1 && this.isPinching) {
        this.isPinching = false;
        this.initialPinchCenter = null;
        this.initialPinchWorldCenter = null;

        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        const clickedDevice = this.getDeviceAtPosition(x, y);
        if (clickedDevice) {
          if (!this.selectedDevices.has(clickedDevice.id)) {
            this.selectedDevices.clear();
            this.selectedDevices.add(clickedDevice.id);
          }
          this.isDraggingDevice = true;
          this.draggedDevice = clickedDevice;
          const worldCoords = this.screenToWorld(x, y);
          this.deviceDragOffsetX = worldCoords.x - clickedDevice.x;
          this.deviceDragOffsetY = worldCoords.y - clickedDevice.y;
          this.canvas.style.cursor = 'move';
        } else {
          this.isDragging = true;
          this.touchPanStartX = touch.clientX;
          this.touchPanStartY = touch.clientY;
          this.touchPanStartOffsetX = this.panOffsetX;
          this.touchPanStartOffsetY = this.panOffsetY;
          this.canvas.style.cursor = 'grabbing';
        }
      }
    });
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
    const newDevices = new Map<string, Types.NetworkDevice>();
    const currentDeviceIds = new Set<string>();

    devices.forEach(device => {
      currentDeviceIds.add(device.id);

      const existingDevice = this.devices.get(device.id);
      if (existingDevice) {
        if (this.isDraggingDevice && this.draggedDevice && this.draggedDevice.id === device.id) {
          const updatedDevice = {
            ...device,
            x: this.draggedDevice.x,
            y: this.draggedDevice.y
          };
          newDevices.set(device.id, updatedDevice);
          this.draggedDevice = updatedDevice;
        } else {
          newDevices.set(device.id, {
            ...device,
            x: existingDevice.x,
            y: existingDevice.y
          });
        }
      } else {
        this.positionNewDevice(device);
        newDevices.set(device.id, device);
      }
    });

    for (const deviceId of this.manuallyPositionedDevices) {
      if (!currentDeviceIds.has(deviceId)) {
        this.manuallyPositionedDevices.delete(deviceId);
      }
    }

    const devicesToResolve = Array.from(newDevices.values()).filter(
      device => !(this.isDraggingDevice && this.selectedDevices.has(device.id)) &&
               this.passesDeviceFilter(device)
    );

    if (devicesToResolve.length > 0) {
      this.resolveAllCollisions(devicesToResolve);
    }

    this.devices = newDevices;

    this.connections.clear();
    connections.forEach(connection => {
      this.connections.set(connection.id, connection);
    });
  }

  addPacketAnimation(connectionId: string, protocol: Types.Protocol): void {
    const MAX_ANIMATIONS = 100;
    
    if (this.packetAnimations.length >= MAX_ANIMATIONS) {
      this.packetAnimations.shift();
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
    this.drawSelection();
    this.drawSelectionRectangle();

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
    const ANIMATION_TIMEOUT_MS = 5000;

    this.packetAnimations = this.packetAnimations.filter(anim => {
      const connection = this.connections.get(anim.connectionId);
      if (!connection) {
        return Date.now() - anim.timestamp < ANIMATION_TIMEOUT_MS;
      }

      const sourceDevice = this.devices.get(connection.sourceId);
      const destDevice = this.devices.get(connection.destId);

      if (!sourceDevice || !destDevice) {
        return Date.now() - anim.timestamp < ANIMATION_TIMEOUT_MS;
      }

      if (!this.passesDeviceFilter(sourceDevice) || !this.passesDeviceFilter(destDevice)) {
        return false;
      }

      if (this.filters.protocol !== 'all' && connection.protocol !== this.filters.protocol) {
        return false;
      }

      const x = sourceDevice.x + (destDevice.x - sourceDevice.x) * anim.progress;
      const y = sourceDevice.y + (destDevice.y - sourceDevice.y) * anim.progress;

      const color = colorManager.getProtocolColor(anim.protocol);

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

        const color = colorManager.getProtocolColor(connection.protocol);
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
    const { ip, ipType, broadcast, showLocalDevice } = this.filters;

    // Always show local device unless explicitly hidden
    if (this.isMyDevice(device)) {
      return showLocalDevice;
    }

    if (ipType === 'local' && !this.isLocalIP(device.ip)) {
      return false;
    }

    if (ipType === 'public' && this.isLocalIP(device.ip)) {
      return false;
    }

    if (ip && !device.ip.includes(ip)) {
      return false;
    }

    if (!broadcast && this.isBroadcastOrMulticast(device.ip)) {
      return false;
    }

    return true;
  }

  setFilters(filters: Partial<Types.FilterOptions>): void {
    this.filters = { ...this.filters, ...filters };

    for (const deviceId of this.selectedDevices) {
      const device = this.devices.get(deviceId);
      if (device && !this.passesDeviceFilter(device)) {
        this.selectedDevices.delete(deviceId);
      }
    }
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

  private isBroadcastOrMulticast(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return false;
    }

    const [first, second, third, fourth] = parts.map(part => parseInt(part, 10));

    if (isNaN(first) || isNaN(second) || isNaN(third) || isNaN(fourth)) {
      return false;
    }

    if (first === 255 && second === 255 && third === 255 && fourth === 255) {
      return true;
    }

    if (first >= 224 && first <= 239) {
      return true;
    }

    if (fourth === 255) {
      return true;
    }

    return false;
  }

  private drawDevice(device: Types.NetworkDevice): void {
    const baseRadius = 25;
    const trafficBonus = Math.min((device.trafficIn + device.trafficOut) / 10000, 15);
    const radius = baseRadius + trafficBonus;
    const isMyDevice = this.isMyDevice(device);
    const isBeingDragged = this.isDraggingDevice && this.draggedDevice === device;
    const isSelected = this.selectedDevices.has(device.id);

    if (isMyDevice) {
      const pulseIntensity = (Math.sin(Date.now() / 500) + 1) / 2;
      const glowRadius = radius + 10 + pulseIntensity * 15;

      const myDeviceColors = colorManager.getMyDeviceColors();
      const glowGradient = this.ctx.createRadialGradient(
        device.x, device.y, radius,
        device.x, device.y, glowRadius
      );
      glowGradient.addColorStop(0, `${myDeviceColors.glow} ${0.4 + pulseIntensity * 0.3})`);
      glowGradient.addColorStop(0.5, `${myDeviceColors.glow} ${0.2 + pulseIntensity * 0.15})`);
      glowGradient.addColorStop(1, `${myDeviceColors.glow} 0)`);

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
      const myDeviceColors = colorManager.getMyDeviceColors();
      gradient.addColorStop(0, myDeviceColors.start);
      gradient.addColorStop(1, myDeviceColors.end);
    } else if (isLocal) {
      const localDeviceColors = colorManager.getLocalDeviceColors();
      gradient.addColorStop(0, localDeviceColors.start);
      gradient.addColorStop(1, localDeviceColors.end);
    } else {
      const publicDeviceColors = colorManager.getPublicDeviceColors();
      gradient.addColorStop(0, publicDeviceColors.start);
      gradient.addColorStop(1, publicDeviceColors.end);
    }

    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    if (!isBeingDragged) {
      this.ctx.strokeStyle = isMyDevice ? 'rgba(100, 255, 150, 0.5)' : 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(device.x, device.y, radius + 3, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    if (isBeingDragged) {
      this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(device.x, device.y, radius + 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    if (isSelected && !isBeingDragged) {
      this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.9)';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(device.x, device.y, radius + 4, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(device.x, device.y, radius + 8, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = isBeingDragged ? 'bold 12px Arial' : 'bold 11px Arial';
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
      if (distance <= radius) {
        return device;
      }
    }
    return null;
  }

  updateCursor(x: number, y: number): void {
    const device = this.getDeviceAtPosition(x, y);
    if (device) {
      this.canvas.style.cursor = 'move';
    } else if (!this.isDraggingDevice && !this.isDragging) {
      this.canvas.style.cursor = 'grab';
    }
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
    return this.localIp !== null && device.ip === this.localIp && !device.ip.startsWith('127.');
  }

  private notifyDevicePositionChanged(device: Types.NetworkDevice): void {
    // In a real implementation, this would send the updated position to the backend
    // For now, we'll just log it. The position is already updated in the local device object.
    if (this.localIp && device.ip !== this.localIp) {
      // Only send position updates for other devices, not our own
      console.log(`Device ${device.ip} moved to (${device.x.toFixed(0)}, ${device.y.toFixed(0)})`);
    }
  }

  setDevicePosition(deviceId: string, x: number, y: number): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.x = x;
      device.y = y;
    }
  }

  private positionNewDevice(device: Types.NetworkDevice): void {
    device.x = Math.random() * 1000;
    device.y = Math.random() * 1000;
  }

  private resolveAllCollisions(devices: Types.NetworkDevice[]): void {
    const separationAttempts = 50;

    for (let attempt = 0; attempt < separationAttempts; attempt++) {
      let hasCollision = false;

      for (const [ip1, device1] of devices.entries()) {
        for (const [ip2, device2] of devices.entries()) {
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

      devices.forEach(device => {
        if (!this.manuallyPositionedDevices.has(device.id)) {
          device.x = Math.max(-1000, Math.min(1000, device.x));
          device.y = Math.max(-1000, Math.min(1000, device.y));
        }
      });
    }
  }

  private getDeviceRadius(device: Types.NetworkDevice): number {
    const baseRadius = 25;
    const trafficBonus = Math.min((device.trafficIn + device.trafficOut) / 10000, 15);
    return baseRadius + trafficBonus;
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private finalizeSelection(): void {
    if (!this.selectionStart || !this.selectionEnd) {
      return;
    }

    const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);

    for (const device of this.devices.values()) {
      if (device.x >= x1 && device.x <= x2 && device.y >= y1 && device.y <= y2) {
        this.selectedDevices.add(device.id);
      }
    }
  }

  private drawSelection(): void {
    for (const deviceId of this.selectedDevices) {
      const device = this.devices.get(deviceId);
      if (!device) continue;

      const isBeingDragged = this.isDraggingDevice && this.draggedDevice === device;
      if (isBeingDragged) continue;

      const baseRadius = 25;
      const trafficBonus = Math.min((device.trafficIn + device.trafficOut) / 10000, 15);
      const radius = baseRadius + trafficBonus;

      this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.9)';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(device.x, device.y, radius + 4, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(device.x, device.y, radius + 8, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawSelectionRectangle(): void {
    if (!this.isSelecting || !this.selectionStart || !this.selectionEnd) {
      return;
    }

    const x = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const y = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
    const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);

    this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
    this.ctx.fillRect(x, y, width, height);
  }
}
