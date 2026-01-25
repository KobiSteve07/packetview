import * as Types from '../../../shared/types';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;

  private messageHandlers: Map<Types.WebSocketMessageType, (data: any) => void>;

  constructor(url: string = 'ws://localhost:3001/ws') {
    this.url = url || this.getWebSocketUrl();
    this.messageHandlers = new Map();
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket:', this.url);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message: Types.WebSocketMessage = JSON.parse(event.data);
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          handler(message.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  onMessage(type: Types.WebSocketMessageType, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  offMessage(type: Types.WebSocketMessageType): void {
    this.messageHandlers.delete(type);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001/api') {
    this.baseUrl = baseUrl;
  }

  async getInterfaces(): Promise<Types.InterfaceInfo[]> {
    const response = await fetch(`${this.baseUrl}/interfaces`);
    const data = await response.json();
    return data.interfaces;
  }

  async startCapture(options: Types.CaptureOptions): Promise<void> {
    await fetch(`${this.baseUrl}/capture/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options)
    });
  }

  async stopCapture(): Promise<void> {
    await fetch(`${this.baseUrl}/capture/stop`, {
      method: 'POST'
    });
  }

  async getCaptureStatus(): Promise<{ capturing: boolean }> {
    const response = await fetch(`${this.baseUrl}/capture/status`);
    return response.json();
  }
}
