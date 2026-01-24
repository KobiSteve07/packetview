import { WebSocketService } from './services/api';
import { VisualizationService } from './services/visualization';
import * as Types from './types';
import './styles/global.css';

export class PacketViewApp {
  private wsService: WebSocketService;
  private vizService: VisualizationService;
  private interfaces: Types.InterfaceInfo[] = [];
  private totalPackets: number = 0;
  private totalTraffic: number = 0;

  constructor() {
    this.wsService = new WebSocketService('');

    const canvas = document.createElement('canvas');
    canvas.id = 'canvas-container';
    const vizContainer = document.getElementById('visualization');
    if (vizContainer) {
      vizContainer.appendChild(canvas);
    }
    this.vizService = new VisualizationService(canvas);

    const controlPanel = this.createControlPanel();
    const statsPanel = this.createStatsPanel();
    const deviceTooltip = this.createDeviceTooltip();

    document.body.appendChild(controlPanel);
    document.body.appendChild(statsPanel);
    document.body.appendChild(deviceTooltip);

    this.setupWebSocketHandlers();
    this.setupEventListeners();
    this.loadInterfaces();
    this.vizService.start();
  }

  private createControlPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'control-panel';
    panel.innerHTML = `
      <h2>PacketView</h2>
      <div class="section">
        <label>Network Interfaces</label>
        <div id="interface-checkboxes" class="interface-checkboxes"></div>
      </div>
      <div class="section filter-section">
        <h3>Live Filters</h3>
        <div class="filter-row">
          <label for="ip-filter">IP Address:</label>
          <input type="text" id="ip-filter" placeholder="e.g., 192.168" />
        </div>
        <div class="filter-row">
          <label for="ip-type-filter">IP Type:</label>
          <select id="ip-type-filter">
            <option value="all">All IPs</option>
            <option value="local">Local Only</option>
            <option value="public">Public Only</option>
          </select>
        </div>
        <div class="filter-row">
          <label for="protocol-filter">Protocol:</label>
          <select id="protocol-filter">
            <option value="all">All Protocols</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
            <option value="ICMP">ICMP</option>
            <option value="HTTP">HTTP</option>
            <option value="HTTPS">HTTPS</option>
            <option value="DNS">DNS</option>
            <option value="SSH">SSH</option>
            <option value="FTP">FTP</option>
            <option value="SMTP">SMTP</option>
          </select>
        </div>
        <div class="filter-row">
          <label for="interface-filter">Interface:</label>
          <select id="interface-filter">
            <option value="all">All Interfaces</option>
          </select>
        </div>
        <div class="filter-row">
          <label for="broadcast-filter" class="checkbox-label">
            <input type="checkbox" id="broadcast-filter" />
            Show Broadcast/Multicast
          </label>
        </div>
      </div>
       <button id="reset-view-btn">Reset View</button>
       <button id="toggle-animations-btn">Disable Animations</button>
       <div class="status active" id="status-panel">
         Status: <span id="status-text">Capturing</span>
       </div>
    `;
    return panel;
  }

  private createStatsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'stats-panel';
    panel.innerHTML = `
      <h3>Network Statistics</h3>
      <div class="stat">
        <span class="label">Total Packets:</span>
        <span class="value" id="total-packets">0</span>
      </div>
      <div class="stat">
        <span class="label">Total Traffic:</span>
        <span class="value" id="total-traffic">0 MB</span>
      </div>
      <div class="stat">
        <span class="label">Active Devices:</span>
        <span class="value" id="active-devices">0</span>
      </div>
      <div class="stat">
        <span class="label">Active Connections:</span>
        <span class="value" id="active-connections">0</span>
      </div>
    `;
    return panel;
  }

  private createDeviceTooltip(): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'device-tooltip';
    tooltip.style.display = 'none';
    return tooltip;
  }

  private setupEventListeners(): void {
    const resetViewBtn = document.getElementById('reset-view-btn') as HTMLButtonElement;
    const ipFilterInput = document.getElementById('ip-filter') as HTMLInputElement;
    const ipTypeFilterSelect = document.getElementById('ip-type-filter') as HTMLSelectElement;
    const protocolFilterSelect = document.getElementById('protocol-filter') as HTMLSelectElement;
    const broadcastFilterCheckbox = document.getElementById('broadcast-filter') as HTMLInputElement;
    const interfaceFilter = document.getElementById('interface-filter') as HTMLSelectElement;

    const updateFilters = () => {
      this.vizService.setFilters({
        ip: ipFilterInput.value.trim(),
        ipType: ipTypeFilterSelect.value as 'all' | 'local' | 'public',
        protocol: protocolFilterSelect.value === 'all' ? 'all' : protocolFilterSelect.value as Types.Protocol,
        broadcast: broadcastFilterCheckbox.checked,
        interface: interfaceFilter.value
      });
    };

    ipFilterInput.addEventListener('input', updateFilters);
    ipTypeFilterSelect.addEventListener('change', updateFilters);
    protocolFilterSelect.addEventListener('change', updateFilters);
    broadcastFilterCheckbox.addEventListener('change', updateFilters);
    interfaceFilter.addEventListener('change', updateFilters);

    resetViewBtn.addEventListener('click', () => this.vizService.resetView());
    document.getElementById('toggle-animations-btn')?.addEventListener('click', () => {
      const isEnabled = this.vizService.togglePacketAnimations();
      const btn = document.getElementById('toggle-animations-btn') as HTMLButtonElement;
      btn.textContent = isEnabled ? 'Disable Animations' : 'Enable Animations';
    });

    document.addEventListener('mousemove', () => this.handleMouseMove());

    this.vizService.start();
  }

  private setupWebSocketHandlers(): void {
    this.wsService.onMessage(Types.WebSocketMessageType.INTERFACE_LIST, (interfaces: Types.InterfaceInfo[]) => {
      this.interfaces = interfaces;
      this.populateInterfaceCheckboxes();
      console.log(`[Frontend] Received ${interfaces.length} network interfaces`);
      
      // Set local IP for device detection
      const firstInterface = interfaces.find(iface => iface.isUp && !iface.ip?.startsWith('127.'));
      if (firstInterface?.ip) {
        this.vizService.setLocalIp(firstInterface.ip);
      }
    });

    this.wsService.onMessage(Types.WebSocketMessageType.PACKET, (packet: Types.Packet) => {
      this.totalPackets++;
      this.totalTraffic += packet.size;
      this.updateStats();

      if (packet.sourceIp && packet.destIp) {
        const connectionId = `${packet.sourceIp}:${packet.sourcePort}-${packet.destIp}:${packet.destPort}-${packet.protocol}`;
        this.vizService.addPacketAnimation(connectionId, packet.protocol);
      }
    });

    this.wsService.onMessage(Types.WebSocketMessageType.NETWORK_STATE, (state: Types.NetworkState) => {
      const devices = state.devices ? Array.from(state.devices.values()) : [];
      const connections = state.connections ? Array.from(state.connections.values()) : [];

      this.vizService.updateNetworkState(devices, connections);

      const activeDevicesEl = document.getElementById('active-devices');
      const activeConnectionsEl = document.getElementById('active-connections');
      if (activeDevicesEl) activeDevicesEl.textContent = devices.length.toString();
      if (activeConnectionsEl) activeConnectionsEl.textContent = connections.length.toString();

      if (devices.length > 0 && this.totalPackets % 100 === 0) {
        console.log(`[Frontend] Network state: ${devices.length} devices, ${connections.length} connections`);
      }
      
      // Update statistics in response to network state changes
      this.updateStats();
    });

    this.wsService.onMessage(Types.WebSocketMessageType.ERROR, (error: any) => {
      console.error('[Frontend] Server error:', error);
      alert(`Error: ${error.error}`);
    });

    this.wsService.connect();
  }

  private populateInterfaceCheckboxes(): void {
    const checkboxContainer = document.getElementById('interface-checkboxes') as HTMLDivElement;
    const interfaceFilter = document.getElementById('interface-filter') as HTMLSelectElement;
    
    checkboxContainer.innerHTML = '';
    interfaceFilter.innerHTML = '';

    this.interfaces.forEach(iface => {
      if (!iface.isUp) return;
      
      const checkboxDiv = document.createElement('div');
      checkboxDiv.className = 'interface-checkbox-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `iface-${iface.name}`;
      checkbox.value = iface.name;
      checkbox.checked = true;
      
      const label = document.createElement('label');
      label.htmlFor = `iface-${iface.name}`;
      label.textContent = `${iface.name} (${iface.ip || 'No IP'}) ${iface.isUp ? '↑' : '↓'}`;
      
      checkboxDiv.appendChild(checkbox);
      checkboxDiv.appendChild(label);
      checkboxContainer.appendChild(checkboxDiv);
    });

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Interfaces';
    interfaceFilter.appendChild(allOption);

    this.interfaces.filter(iface => iface.isUp).forEach(iface => {
      const option = document.createElement('option');
      option.value = iface.name;
      option.textContent = `${iface.name} (${iface.ip || 'No IP'})`;
      interfaceFilter.appendChild(option);
    });
  }

  private handleMouseMove(): void {
    const tooltip = document.getElementById('device-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  private updateStats(): void {
    const totalPacketsEl = document.getElementById('total-packets');
    const totalTrafficEl = document.getElementById('total-traffic');

    if (totalPacketsEl) totalPacketsEl.textContent = this.totalPackets.toString();
    if (totalTrafficEl) totalTrafficEl.textContent = this.formatBytes(this.totalTraffic);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  private loadInterfaces(): void {
    fetch('/api/interfaces')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        this.interfaces = data.interfaces;
        this.populateInterfaceCheckboxes();
        console.log('Loaded interfaces:', this.interfaces);
      })
      .catch(error => {
        console.error('Failed to load interfaces:', error);
      });
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PacketViewApp();
});