export interface Packet {
    timestamp: number;
    sourceIp: string;
    destIp: string;
    sourcePort: number;
    destPort: number;
    protocol: Protocol;
    size: number;
    info?: string;
}
export declare enum Protocol {
    TCP = "TCP",
    UDP = "UDP",
    ICMP = "ICMP",
    HTTP = "HTTP",
    HTTPS = "HTTPS",
    DNS = "DNS",
    SSH = "SSH",
    FTP = "FTP",
    SMTP = "SMTP",
    OTHER = "OTHER"
}
export interface NetworkDevice {
    id: string;
    ip: string;
    mac: string;
    hostname?: string;
    type: DeviceType;
    x: number;
    y: number;
    trafficIn: number;
    trafficOut: number;
    lastSeen: number;
}
export declare enum DeviceType {
    HOST = "HOST",
    ROUTER = "ROUTER",
    SWITCH = "SWITCH",
    FIREWALL = "FIREWALL",
    GATEWAY = "GATEWAY",
    UNKNOWN = "UNKNOWN"
}
export interface NetworkConnection {
    id: string;
    sourceId: string;
    destId: string;
    protocol: Protocol;
    traffic: number;
    packets: number;
    lastSeen: number;
}
export interface TrafficFlow {
    connectionId: string;
    packets: Packet[];
    timestamp: number;
}
export interface NetworkState {
    devices: Map<string, NetworkDevice>;
    connections: Map<string, NetworkConnection>;
    flows: TrafficFlow[];
}
export interface InterfaceInfo {
    name: string;
    description: string;
    ip?: string;
    isUp: boolean;
}
export declare enum WebSocketMessageType {
    PACKET = "PACKET",
    DEVICE_UPDATE = "DEVICE_UPDATE",
    CONNECTION_UPDATE = "CONNECTION_UPDATE",
    NETWORK_STATE = "NETWORK_STATE",
    INTERFACE_LIST = "INTERFACE_LIST",
    ERROR = "ERROR"
}
export interface WebSocketMessage {
    type: WebSocketMessageType;
    data: any;
    timestamp: number;
}
export interface CaptureOptions {
    interface: string;
    filter?: string;
    promiscuous?: boolean;
}
//# sourceMappingURL=index.d.ts.map