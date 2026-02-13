import * as Types from '../../../shared/types';

export interface DeviceColors {
  myDevice: {
    start: string;
    end: string;
    glow: string;
  };
  localDevice: {
    start: string;
    end: string;
  };
  publicDevice: {
    start: string;
    end: string;
  };
}

export interface UITheme {
  mode: 'system' | 'custom';
  accentColor: string;
}

export interface ColorConfig {
  protocolColors: Record<Types.Protocol, string>;
  deviceColors: DeviceColors;
  uiTheme: UITheme;
}

const DEFAULT_COLOR_CONFIG: ColorConfig = {
  protocolColors: {
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
  },
  deviceColors: {
    myDevice: {
      start: '#64ff96',
      end: '#2a8a4a',
      glow: 'rgba(100, 255, 150,'
    },
    localDevice: {
      start: '#4a9eff',
      end: '#2a2a8a'
    },
    publicDevice: {
      start: '#ff9e4a',
      end: '#8a2a2a'
    }
  },
  uiTheme: {
    mode: 'system',
    accentColor: '#4a9eff'
  }
};

const STORAGE_KEY = 'packetview_color_config';

export class ColorManager {
  private colorConfig: ColorConfig;
  private listeners: Array<(config: ColorConfig) => void> = [];

  constructor() {
    this.colorConfig = this.loadFromStorage() || { ...DEFAULT_COLOR_CONFIG };
  }

  private loadFromStorage(): ColorConfig | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load color config from storage:', e);
    }
    return null;
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.colorConfig));
    } catch (e) {
      console.error('Failed to save color config to storage:', e);
    }
  }

  public getProtocolColor(protocol: Types.Protocol): string {
    return this.colorConfig.protocolColors[protocol] || this.colorConfig.protocolColors.OTHER;
  }

  public getDeviceColors(): DeviceColors {
    return this.colorConfig.deviceColors;
  }

  public getMyDeviceColors(): { start: string; end: string; glow: string } {
    return this.colorConfig.deviceColors.myDevice;
  }

  public getLocalDeviceColors(): { start: string; end: string } {
    return this.colorConfig.deviceColors.localDevice;
  }

  public getPublicDeviceColors(): { start: string; end: string } {
    return this.colorConfig.deviceColors.publicDevice;
  }

  public setProtocolColor(protocol: Types.Protocol, color: string): void {
    this.colorConfig.protocolColors[protocol] = color;
    this.saveToStorage();
    this.notifyListeners();
  }

  public setMyDeviceColor(start: string, end: string, glowBase?: string): void {
    this.colorConfig.deviceColors.myDevice.start = start;
    this.colorConfig.deviceColors.myDevice.end = end;
    if (glowBase) {
      this.colorConfig.deviceColors.myDevice.glow = glowBase;
    }
    this.saveToStorage();
    this.notifyListeners();
  }

  public setLocalDeviceColor(start: string, end: string): void {
    this.colorConfig.deviceColors.localDevice.start = start;
    this.colorConfig.deviceColors.localDevice.end = end;
    this.saveToStorage();
    this.notifyListeners();
  }

  public setPublicDeviceColor(start: string, end: string): void {
    this.colorConfig.deviceColors.publicDevice.start = start;
    this.colorConfig.deviceColors.publicDevice.end = end;
    this.saveToStorage();
    this.notifyListeners();
  }

  public getUITheme(): UITheme {
    return { ...this.colorConfig.uiTheme };
  }

  public setUITheme(mode: 'system' | 'custom', accentColor?: string): void {
    this.colorConfig.uiTheme.mode = mode;
    if (accentColor) {
      this.colorConfig.uiTheme.accentColor = accentColor;
    }
    this.saveToStorage();
    this.notifyListeners();
  }

  public getColorConfig(): ColorConfig {
    return { ...this.colorConfig };
  }

  public resetToDefaults(): void {
    this.colorConfig = {
      protocolColors: { ...DEFAULT_COLOR_CONFIG.protocolColors },
      deviceColors: {
        myDevice: { ...DEFAULT_COLOR_CONFIG.deviceColors.myDevice },
        localDevice: { ...DEFAULT_COLOR_CONFIG.deviceColors.localDevice },
        publicDevice: { ...DEFAULT_COLOR_CONFIG.deviceColors.publicDevice }
      },
      uiTheme: { ...DEFAULT_COLOR_CONFIG.uiTheme }
    };
    this.saveToStorage();
    this.notifyListeners();
  }

  public subscribe(listener: (config: ColorConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const configCopy = { ...this.colorConfig };
    this.listeners.forEach(listener => {
      listener(configCopy);
    });
  }

  public getGlowColorWithOpacity(opacity: number): string {
    return `${this.colorConfig.deviceColors.myDevice.glow} ${opacity})`;
  }
}

export const colorManager = new ColorManager();
