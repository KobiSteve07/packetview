import { WebSocketService } from './services/api';
import { VisualizationService } from './services/visualization';
import { colorManager } from './services/ColorManager';
import * as Types from './shared/types';
import './styles/global.css';

export class PacketViewApp {
  private wsService: WebSocketService;
  private vizService: VisualizationService;
  private canvas: HTMLCanvasElement;
  private interfaces: Types.InterfaceInfo[] = [];
  private totalPackets: number = 0;
  private totalTraffic: number = 0;
  private colorPanelVisible: boolean = false;
  private devicePropertiesPanel: HTMLElement | null = null;

  constructor() {
    this.wsService = new WebSocketService('');

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'canvas-container';
    const vizContainer = document.getElementById('visualization');
    if (vizContainer) {
      vizContainer.appendChild(this.canvas);
    }
    this.vizService = new VisualizationService(this.canvas);

    const controlPanel = this.createControlPanel();
    const statsPanel = this.createStatsPanel();
    const deviceTooltip = this.createDeviceTooltip();
    const colorPanel = this.createColorManagerPanel();
    this.devicePropertiesPanel = this.createDevicePropertiesPanel();

    document.body.appendChild(controlPanel);
    document.body.appendChild(statsPanel);
    document.body.appendChild(deviceTooltip);
    document.body.appendChild(colorPanel);
    if (this.devicePropertiesPanel) {
      document.body.appendChild(this.devicePropertiesPanel);
    }

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
        <div class="filter-row">
          <label for="local-device-filter" class="checkbox-label">
            <input type="checkbox" id="local-device-filter" checked />
            Show Scanning Device
          </label>
        </div>
       </div>
       <button id="reset-view-btn">Reset View</button>
       <button id="toggle-animations-btn">Disable Animations</button>
       <button id="color-manager-btn">Color Manager</button>
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

  private createColorManagerPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'color-manager-panel';
    if (this.colorPanelVisible) {
      panel.classList.add('visible');
    }

    panel.innerHTML = `
      <div class="color-manager-header">
        <h3>Color Manager</h3>
        <button id="close-color-panel" class="close-button">×</button>
      </div>
      <div class="color-manager-content">
        <div class="color-section">
          <h4>Protocol Colors</h4>
          <div class="color-row">
            <label for="tcp-color">TCP</label>
            <input type="color" id="tcp-color" value="${colorManager.getProtocolColor(Types.Protocol.TCP)}" />
            <button class="reset-color-btn" data-protocol="TCP">Reset</button>
          </div>
          <div class="color-row">
            <label for="udp-color">UDP</label>
            <input type="color" id="udp-color" value="${colorManager.getProtocolColor(Types.Protocol.UDP)}" />
            <button class="reset-color-btn" data-protocol="UDP">Reset</button>
          </div>
          <div class="color-row">
            <label for="icmp-color">ICMP</label>
            <input type="color" id="icmp-color" value="${colorManager.getProtocolColor(Types.Protocol.ICMP)}" />
            <button class="reset-color-btn" data-protocol="ICMP">Reset</button>
          </div>
          <div class="color-row">
            <label for="http-color">HTTP</label>
            <input type="color" id="http-color" value="${colorManager.getProtocolColor(Types.Protocol.HTTP)}" />
            <button class="reset-color-btn" data-protocol="HTTP">Reset</button>
          </div>
          <div class="color-row">
            <label for="https-color">HTTPS</label>
            <input type="color" id="https-color" value="${colorManager.getProtocolColor(Types.Protocol.HTTPS)}" />
            <button class="reset-color-btn" data-protocol="HTTPS">Reset</button>
          </div>
          <div class="color-row">
            <label for="dns-color">DNS</label>
            <input type="color" id="dns-color" value="${colorManager.getProtocolColor(Types.Protocol.DNS)}" />
            <button class="reset-color-btn" data-protocol="DNS">Reset</button>
          </div>
          <div class="color-row">
            <label for="ssh-color">SSH</label>
            <input type="color" id="ssh-color" value="${colorManager.getProtocolColor(Types.Protocol.SSH)}" />
            <button class="reset-color-btn" data-protocol="SSH">Reset</button>
          </div>
          <div class="color-row">
            <label for="ftp-color">FTP</label>
            <input type="color" id="ftp-color" value="${colorManager.getProtocolColor(Types.Protocol.FTP)}" />
            <button class="reset-color-btn" data-protocol="FTP">Reset</button>
          </div>
          <div class="color-row">
            <label for="smtp-color">SMTP</label>
            <input type="color" id="smtp-color" value="${colorManager.getProtocolColor(Types.Protocol.SMTP)}" />
            <button class="reset-color-btn" data-protocol="SMTP">Reset</button>
          </div>
        </div>
        <div class="color-section">
          <h4>Device Colors</h4>
          <div class="device-color-group">
            <label>My Device</label>
            <div class="gradient-color-row">
              <input type="color" id="my-device-start" value="${colorManager.getMyDeviceColors().start}" />
              <span>→</span>
              <input type="color" id="my-device-end" value="${colorManager.getMyDeviceColors().end}" />
            </div>
          </div>
          <div class="device-color-group">
            <label>Local Device</label>
            <div class="gradient-color-row">
              <input type="color" id="local-device-start" value="${colorManager.getLocalDeviceColors().start}" />
              <span>→</span>
              <input type="color" id="local-device-end" value="${colorManager.getLocalDeviceColors().end}" />
            </div>
          </div>
          <div class="device-color-group">
            <label>Public Device</label>
            <div class="gradient-color-row">
              <input type="color" id="public-device-start" value="${colorManager.getPublicDeviceColors().start}" />
              <span>→</span>
              <input type="color" id="public-device-end" value="${colorManager.getPublicDeviceColors().end}" />
            </div>
          </div>
        </div>
      </div>
      <div class="color-manager-footer">
        <button id="reset-all-colors" class="reset-all-btn">Reset All to Defaults</button>
      </div>
    `;

    this.setupColorManagerListeners(panel);
    return panel;
  }

  private setupColorManagerListeners(panel: HTMLElement): void {
    const closeBtn = panel.querySelector('#close-color-panel') as HTMLButtonElement;
    closeBtn?.addEventListener('click', () => {
      this.colorPanelVisible = false;
      panel.classList.remove('visible');
      this.updateDevicePropertiesPanelPosition();
    });

    panel.querySelectorAll('input[id$="-color"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const protocolStr = target.id.replace('-color', '').toUpperCase();
        const protocol = Object.values(Types.Protocol).find(p => p === protocolStr);
        if (protocol) {
          colorManager.setProtocolColor(protocol, target.value);
        }
      });
    });

    panel.querySelectorAll('.reset-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn as HTMLButtonElement;
        const protocolStr = target.dataset.protocol?.toUpperCase();
        const protocol = Object.values(Types.Protocol).find(p => p === protocolStr);
        const defaultColor = protocol ? this.getDefaultProtocolColor(protocol) : undefined;
        if (defaultColor && protocol) {
          colorManager.setProtocolColor(protocol, defaultColor);
          const input = panel.querySelector(`#${protocol.toLowerCase()}-color`) as HTMLInputElement;
          if (input) input.value = defaultColor;
        }
      });
    });

    const myDeviceStart = panel.querySelector('#my-device-start') as HTMLInputElement;
    const myDeviceEnd = panel.querySelector('#my-device-end') as HTMLInputElement;
    myDeviceStart?.addEventListener('input', (e) => {
      colorManager.setMyDeviceColor((e.target as HTMLInputElement).value, myDeviceEnd.value);
    });
    myDeviceEnd?.addEventListener('input', (e) => {
      colorManager.setMyDeviceColor(myDeviceStart.value, (e.target as HTMLInputElement).value);
    });

    const localDeviceStart = panel.querySelector('#local-device-start') as HTMLInputElement;
    const localDeviceEnd = panel.querySelector('#local-device-end') as HTMLInputElement;
    localDeviceStart?.addEventListener('input', (e) => {
      colorManager.setLocalDeviceColor((e.target as HTMLInputElement).value, localDeviceEnd.value);
    });
    localDeviceEnd?.addEventListener('input', (e) => {
      colorManager.setLocalDeviceColor(localDeviceStart.value, (e.target as HTMLInputElement).value);
    });

    const publicDeviceStart = panel.querySelector('#public-device-start') as HTMLInputElement;
    const publicDeviceEnd = panel.querySelector('#public-device-end') as HTMLInputElement;
    publicDeviceStart?.addEventListener('input', (e) => {
      colorManager.setPublicDeviceColor((e.target as HTMLInputElement).value, publicDeviceEnd.value);
    });
    publicDeviceEnd?.addEventListener('input', (e) => {
      colorManager.setPublicDeviceColor(publicDeviceStart.value, (e.target as HTMLInputElement).value);
    });

    const resetAllBtn = panel.querySelector('#reset-all-colors') as HTMLButtonElement;
    resetAllBtn?.addEventListener('click', () => {
      console.log('Reset all colors button clicked');
      colorManager.resetToDefaults();
      this.updateColorManagerUI();
    });
  }

  private getDefaultProtocolColor(protocol: Types.Protocol): string | undefined {
    const defaults: Record<string, string> = {
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
    return defaults[protocol];
  }

  private createDevicePropertiesPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'device-properties-panel';
    panel.innerHTML = `
      <div class="device-properties-header">
        <h3>Selected Devices</h3>
        <button id="close-device-properties" class="close-button">×</button>
      </div>
      <div class="device-properties-content">
        <div class="device-properties-summary">
          <div class="property-row">
            <span class="property-label">Devices Selected:</span>
            <span class="property-value" id="selected-count">0</span>
          </div>
          <div class="property-row">
            <span class="property-label">Total Traffic:</span>
            <span class="property-value" id="selected-total-traffic">0 B</span>
          </div>
          <div class="property-row">
            <span class="property-label">Traffic In:</span>
            <span class="property-value" id="selected-traffic-in">0 B</span>
          </div>
          <div class="property-row">
            <span class="property-label">Traffic Out:</span>
            <span class="property-value" id="selected-traffic-out">0 B</span>
          </div>
          <div class="property-row">
            <span class="property-label">Local Devices:</span>
            <span class="property-value" id="selected-local-count">0</span>
          </div>
          <div class="property-row">
            <span class="property-label">Public Devices:</span>
            <span class="property-value" id="selected-public-count">0</span>
          </div>
        </div>
        <div class="device-types-section" id="device-types-section" style="display: none;">
          <h4>Device Types</h4>
          <div id="device-types-list"></div>
        </div>
        <div class="selected-devices-list" id="selected-devices-list"></div>
      </div>
    `;

    const closeBtn = panel.querySelector('#close-device-properties') as HTMLButtonElement;
    closeBtn?.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    return panel;
  }

  private updateDevicePropertiesPanel(): void {
    if (!this.devicePropertiesPanel) return;

    const stats = this.vizService.getSelectedDevicesStats();
    const selectedDevices = this.vizService.getSelectedDevices();

    if (stats.count === 0) {
      this.devicePropertiesPanel.classList.remove('visible');
      return;
    }

    this.devicePropertiesPanel.classList.add('visible');

    const countEl = this.devicePropertiesPanel.querySelector('#selected-count');
    const totalTrafficEl = this.devicePropertiesPanel.querySelector('#selected-total-traffic');
    const trafficInEl = this.devicePropertiesPanel.querySelector('#selected-traffic-in');
    const trafficOutEl = this.devicePropertiesPanel.querySelector('#selected-traffic-out');
    const localCountEl = this.devicePropertiesPanel.querySelector('#selected-local-count');
    const publicCountEl = this.devicePropertiesPanel.querySelector('#selected-public-count');

    if (countEl) countEl.textContent = stats.count.toString();
    if (totalTrafficEl) totalTrafficEl.textContent = this.formatBytes(stats.totalTraffic);
    if (trafficInEl) trafficInEl.textContent = this.formatBytes(stats.totalTrafficIn);
    if (trafficOutEl) trafficOutEl.textContent = this.formatBytes(stats.totalTrafficOut);
    if (localCountEl) localCountEl.textContent = stats.localDevices.toString();
    if (publicCountEl) publicCountEl.textContent = stats.publicDevices.toString();

    const deviceTypesSection = this.devicePropertiesPanel.querySelector('#device-types-section') as HTMLElement;
    const deviceTypesList = this.devicePropertiesPanel.querySelector('#device-types-list');

    if (deviceTypesSection && deviceTypesList) {
      const typeEntries = Object.entries(stats.deviceTypes);
      if (typeEntries.length > 0) {
        deviceTypesSection.style.display = 'block';
        deviceTypesList.innerHTML = typeEntries
          .map(([type, count]) => `
            <div class="device-type-row">
              <span class="device-type-name">${type}:</span>
              <span class="device-type-count">${count}</span>
            </div>
          `)
          .join('');
      } else {
        deviceTypesSection.style.display = 'none';
      }
    }

    const devicesList = this.devicePropertiesPanel.querySelector('#selected-devices-list');
    if (devicesList) {
      if (selectedDevices.length <= 10) {
        devicesList.innerHTML = selectedDevices
          .map(device => `
            <div class="selected-device-item">
              <span class="device-ip">${device.ip}</span>
              <span class="device-traffic">${this.formatBytes(device.trafficIn + device.trafficOut)}</span>
            </div>
          `)
          .join('');
      } else {
        devicesList.innerHTML = `
          <div class="selected-device-item">
            <span class="device-ip">${selectedDevices.length} devices selected</span>
          </div>
          <div class="selected-device-item" style="font-size: 11px; color: #888;">
            <span>Individual list hidden for performance</span>
          </div>
        `;
      }
    }

    this.updateDevicePropertiesPanelPosition();
  }

  private updateDevicePropertiesPanelPosition(): void {
    if (!this.devicePropertiesPanel) return;

    const colorPanel = document.querySelector('.color-manager-panel') as HTMLElement;
    const isColorPanelVisible = colorPanel && colorPanel.classList.contains('visible');

    if (isColorPanelVisible) {
      this.devicePropertiesPanel.classList.add('shifted');
    } else {
      this.devicePropertiesPanel.classList.remove('shifted');
    }
  }

  private updateColorManagerUI(): void {
    const panel = document.querySelector('.color-manager-panel') as HTMLElement;
    if (!panel) return;

    const protocolStrings = ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS', 'DNS', 'SSH', 'FTP', 'SMTP'];
    protocolStrings.forEach(protocolStr => {
      const protocol = Object.values(Types.Protocol).find(p => p === protocolStr);
      if (protocol) {
        const input = panel.querySelector(`#${protocolStr.toLowerCase()}-color`) as HTMLInputElement;
        if (input) input.value = colorManager.getProtocolColor(protocol);
      }
    });

    const myDeviceStart = panel.querySelector('#my-device-start') as HTMLInputElement;
    const myDeviceEnd = panel.querySelector('#my-device-end') as HTMLInputElement;
    if (myDeviceStart) myDeviceStart.value = colorManager.getMyDeviceColors().start;
    if (myDeviceEnd) myDeviceEnd.value = colorManager.getMyDeviceColors().end;

    const localDeviceStart = panel.querySelector('#local-device-start') as HTMLInputElement;
    const localDeviceEnd = panel.querySelector('#local-device-end') as HTMLInputElement;
    if (localDeviceStart) localDeviceStart.value = colorManager.getLocalDeviceColors().start;
    if (localDeviceEnd) localDeviceEnd.value = colorManager.getLocalDeviceColors().end;

    const publicDeviceStart = panel.querySelector('#public-device-start') as HTMLInputElement;
    const publicDeviceEnd = panel.querySelector('#public-device-end') as HTMLInputElement;
    if (publicDeviceStart) publicDeviceStart.value = colorManager.getPublicDeviceColors().start;
    if (publicDeviceEnd) publicDeviceEnd.value = colorManager.getPublicDeviceColors().end;
  }

  private setupEventListeners(): void {
    const resetViewBtn = document.getElementById('reset-view-btn') as HTMLButtonElement;
    const ipFilterInput = document.getElementById('ip-filter') as HTMLInputElement;
    const ipTypeFilterSelect = document.getElementById('ip-type-filter') as HTMLSelectElement;
    const protocolFilterSelect = document.getElementById('protocol-filter') as HTMLSelectElement;
    const broadcastFilterCheckbox = document.getElementById('broadcast-filter') as HTMLInputElement;
    const interfaceFilter = document.getElementById('interface-filter') as HTMLSelectElement;
    const localDeviceFilterCheckbox = document.getElementById('local-device-filter') as HTMLInputElement;

    const updateFilters = () => {
      this.vizService.setFilters({
        ip: ipFilterInput.value.trim(),
        ipType: ipTypeFilterSelect.value as 'all' | 'local' | 'public',
        protocol: protocolFilterSelect.value === 'all' ? 'all' : protocolFilterSelect.value as Types.Protocol,
        broadcast: broadcastFilterCheckbox.checked,
        networkInterface: interfaceFilter.value,
        showLocalDevice: localDeviceFilterCheckbox.checked
      });
    };

    ipFilterInput.addEventListener('input', updateFilters);
    ipTypeFilterSelect.addEventListener('change', updateFilters);
    protocolFilterSelect.addEventListener('change', updateFilters);
    broadcastFilterCheckbox.addEventListener('change', updateFilters);
    interfaceFilter.addEventListener('change', updateFilters);
    localDeviceFilterCheckbox.addEventListener('change', updateFilters);

    resetViewBtn.addEventListener('click', () => this.vizService.resetView());
    document.getElementById('toggle-animations-btn')?.addEventListener('click', () => {
      const isEnabled = this.vizService.togglePacketAnimations();
      const btn = document.getElementById('toggle-animations-btn') as HTMLButtonElement;
      btn.textContent = isEnabled ? 'Disable Animations' : 'Enable Animations';
    });

    document.getElementById('color-manager-btn')?.addEventListener('click', () => {
      const colorPanel = document.querySelector('.color-manager-panel') as HTMLElement;
      if (colorPanel) {
        this.colorPanelVisible = !this.colorPanelVisible;
        if (this.colorPanelVisible) {
          colorPanel.classList.add('visible');
        } else {
          colorPanel.classList.remove('visible');
        }
        this.updateDevicePropertiesPanelPosition();
      }
    });

    document.addEventListener('mousemove', () => this.handleMouseMove());

    this.canvas.addEventListener('mouseup', () => {
      setTimeout(() => this.updateDevicePropertiesPanel(), 0);
    });

    this.canvas.addEventListener('touchend', () => {
      setTimeout(() => this.updateDevicePropertiesPanel(), 0);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || (e.key === 'a' && (e.ctrlKey || e.metaKey))) {
        setTimeout(() => this.updateDevicePropertiesPanel(), 0);
      }
    });

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