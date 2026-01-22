"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketMessageType = exports.DeviceType = exports.Protocol = void 0;
var Protocol;
(function (Protocol) {
    Protocol["TCP"] = "TCP";
    Protocol["UDP"] = "UDP";
    Protocol["ICMP"] = "ICMP";
    Protocol["HTTP"] = "HTTP";
    Protocol["HTTPS"] = "HTTPS";
    Protocol["DNS"] = "DNS";
    Protocol["SSH"] = "SSH";
    Protocol["FTP"] = "FTP";
    Protocol["SMTP"] = "SMTP";
    Protocol["OTHER"] = "OTHER";
})(Protocol || (exports.Protocol = Protocol = {}));
var DeviceType;
(function (DeviceType) {
    DeviceType["HOST"] = "HOST";
    DeviceType["ROUTER"] = "ROUTER";
    DeviceType["SWITCH"] = "SWITCH";
    DeviceType["FIREWALL"] = "FIREWALL";
    DeviceType["GATEWAY"] = "GATEWAY";
    DeviceType["UNKNOWN"] = "UNKNOWN";
})(DeviceType || (exports.DeviceType = DeviceType = {}));
var WebSocketMessageType;
(function (WebSocketMessageType) {
    WebSocketMessageType["PACKET"] = "PACKET";
    WebSocketMessageType["DEVICE_UPDATE"] = "DEVICE_UPDATE";
    WebSocketMessageType["CONNECTION_UPDATE"] = "CONNECTION_UPDATE";
    WebSocketMessageType["NETWORK_STATE"] = "NETWORK_STATE";
    WebSocketMessageType["INTERFACE_LIST"] = "INTERFACE_LIST";
    WebSocketMessageType["ERROR"] = "ERROR";
})(WebSocketMessageType || (exports.WebSocketMessageType = WebSocketMessageType = {}));
//# sourceMappingURL=index.js.map