"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const BaseProvider_1 = require("./BaseProvider");
const utils_1 = require("../utils/utils");
const ConfigurationManager_1 = require("../ConfigurationManager");
/**
 * Graph Viewを提供するTreeDataProvider実装
 * 主にWebviewとの通信を管理する
 */
class GraphViewProvider extends BaseProvider_1.BaseProvider {
    constructor(extensionUri) {
        super();
        this._view = null;
        this._currentData = { nodes: [], links: [] };
        this._dataVersion = 0;
        this._updateInProgress = false;
        this._pendingUpdate = null;
        this._callStackPaths = [];
        this._extensionUri = extensionUri;
        this._webviewBridge = new WebviewBridge();
    }
    _getHtmlForWebview() {
        const htmlPath = path.join(__dirname, '../../webview/dist/index.html');
        if (!fs.existsSync(htmlPath)) {
            throw new Error('Webview HTML not found. Run "npm run build:webview" before packaging the extension.');
        }
        return fs.readFileSync(htmlPath, 'utf8');
    }
    async resolveWebviewView(webviewView) {
        this._view = webviewView;
        this._webviewBridge.attach(webviewView.webview, {
            ready: () => {
                this.syncToWebview();
            },
            focusNode: async (params) => {
                if (params.node?.filePath) {
                    await vscode.window.showTextDocument(vscode.Uri.file(params.node.filePath));
                }
            }
        });
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        webviewView.webview.html = this._getHtmlForWebview();
        this.syncToWebview();
    }
    async refresh() {
        this.syncToWebview();
    }
    mergeGraphData(newData) {
        (0, utils_1.mergeGraphData)(this._currentData, newData);
        this._dataVersion += 1;
        this.syncToWebview();
    }
    setGraphData(data) {
        (0, utils_1.validateGraphData)(data);
        this._currentData = {
            nodes: data.nodes ?? [],
            links: data.links ?? []
        };
        this._dataVersion += 1;
        this.syncToWebview();
    }
    async update(data) {
        if (this._updateInProgress) {
            this._pendingUpdate = data;
            return;
        }
        this._updateInProgress = true;
        try {
            await this._performUpdate(data);
            while (this._pendingUpdate) {
                const pending = this._pendingUpdate;
                this._pendingUpdate = null;
                await this._performUpdate(pending);
            }
        }
        finally {
            this._updateInProgress = false;
        }
    }
    async _performUpdate(data) {
        if (!data || data.type === 'controls') {
            this.syncToWebview({ viewOnly: true });
        }
        else if (data.type === 'callStack' && Array.isArray(data.paths)) {
            this._callStackPaths = [...data.paths];
            this.syncToWebview({ viewOnly: true });
        }
        else if (data.type === 'focusNode' && data.filePath) {
            await this.focusNode(data.filePath);
        }
    }
    _findNodeByFilePath(filePath) {
        if (!filePath)
            return undefined;
        return this._currentData.nodes.find(n => {
            const nodePath = (0, utils_1.getNodeFilePath)(n);
            if (!nodePath)
                return false;
            const nodeBasename = nodePath.split('/').pop();
            const fileBasename = filePath.split('/').pop();
            return nodePath === filePath ||
                nodeBasename === fileBasename ||
                filePath.endsWith(nodePath) ||
                nodePath.endsWith(filePath);
        });
    }
    syncToWebview(options = {}) {
        if (!this._view) {
            console.warn('[GraphViewProvider] Cannot sync - view not available');
            return;
        }
        const controls = this.controls && Object.keys(this.controls).length > 0
            ? this.controls
            : ConfigurationManager_1.ConfigurationManager.getInstance().loadControls({ ignoreCache: true });
        const themeKind = vscode.window.activeColorTheme.kind;
        const darkMode = themeKind === vscode.ColorThemeKind.Dark ||
            themeKind === vscode.ColorThemeKind.HighContrast;
        const payload = {
            controls: { ...controls, darkMode, COLORS: ConfigurationManager_1.COLORS, AUTO_ROTATE_DELAY: ConfigurationManager_1.AUTO_ROTATE_DELAY },
            callStackPaths: this._callStackPaths
        };
        if (options.viewOnly) {
            this._webviewBridge.send('view:update', payload);
            return;
        }
        this._webviewBridge.send('graph:update', {
            ...payload,
            data: this._currentData,
            dataVersion: this._dataVersion
        });
    }
    async focusNode(filePath) {
        if (!this._view || !this._currentData?.nodes?.length) {
            return;
        }
        const node = this._findNodeByFilePath(filePath);
        if (node) {
            this._webviewBridge.send('node:focus', node.id);
        }
    }
    async toggle3DMode() {
        if (!this._view) {
            console.warn('[GraphViewProvider] Cannot toggle 3D mode - view not available');
            return;
        }
        // 現在の設定を取得して反転
        const currentMode = (this.controls && this.controls.is3DMode !== undefined)
            ? this.controls.is3DMode
            : ConfigurationManager_1.ConfigurationManager.getInstance().loadControls({ ignoreCache: true }).is3DMode;
        await ConfigurationManager_1.ConfigurationManager.getInstance().updateControl('is3DMode', !currentMode);
        // Webviewに通知してグラフをリセット
        this._webviewBridge.send('mode:toggle');
        // 更新された設定を送信
        this.syncToWebview();
    }
    handleSettingsChanged(controls) {
        super.handleSettingsChanged(controls);
        this.syncToWebview({ viewOnly: true });
    }
    async clearFocus() {
        if (!this._view)
            return;
        this._webviewBridge.send('focus:clear');
    }
}
exports.GraphViewProvider = GraphViewProvider;
const messageParams = {
    'graph:update': (params) => {
        if (!params || typeof params !== 'object') {
            throw new Error('graph:update: params must be an object');
        }
        const { controls, data, callStackPaths = [], dataVersion } = params;
        if (!controls || typeof controls !== 'object') {
            throw new Error('graph:update: controls must be provided');
        }
        (0, utils_1.validateGraphData)(data);
        const message = {
            controls,
            data,
            callStackPaths: Array.isArray(callStackPaths) ? callStackPaths : []
        };
        if (typeof dataVersion === 'number') {
            message.dataVersion = dataVersion;
        }
        return message;
    },
    'view:update': (params) => {
        const validParams = params && typeof params === 'object' ? params : null;
        if (!validParams) {
            throw new Error('view:update: params must be an object');
        }
        const message = {};
        if (validParams.controls && typeof validParams.controls === 'object') {
            message.controls = validParams.controls;
        }
        if (Array.isArray(validParams.callStackPaths)) {
            message.callStackPaths = validParams.callStackPaths;
        }
        return message;
    },
    'node:focus': (nodeId) => {
        if (nodeId === undefined || nodeId === null) {
            throw new Error('node:focus: nodeId is required');
        }
        return { nodeId };
    },
    'mode:toggle': () => {
        return undefined;
    },
    'focus:clear': () => {
        return undefined;
    }
};
/**
 * Webviewとのメッセージングを管理するクラス
 * ExtensionBridgeと対応する
 * 通信は必ずこのクラスを介して行う
 * GraphViewProviderからのみ使用される
 */
class WebviewBridge {
    constructor() {
        this._webview = null;
        this._ready = false;
        this._queue = [];
        this._handlers = {};
    }
    attach(webview, handlers = {}) {
        this._webview = webview;
        this._ready = false;
        this._queue = [];
        this._handlers = handlers;
        if (this._webview?.onDidReceiveMessage) {
            this._webview.onDidReceiveMessage(async (message) => {
                await this._handleReceive(message);
            });
        }
    }
    detach() {
        this._webview = null;
        this._ready = false;
        this._queue = [];
        this._handlers = {};
    }
    markReady() {
        this._ready = true;
        this._flush();
    }
    send(type, payload) {
        const creator = messageParams[type];
        if (!creator) {
            throw new Error(`Unknown message type: ${type}`);
        }
        const params = creator(payload);
        const message = { jsonrpc: '2.0', method: type };
        if (params !== undefined) {
            message.params = params;
        }
        this._dispatch(message);
    }
    _dispatch(message) {
        if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
            throw new Error('Invalid webview message payload');
        }
        if (!this._webview) {
            return false;
        }
        if (this._ready) {
            this._webview.postMessage(message);
            return true;
        }
        this._queue.push(message);
        return false;
    }
    _flush() {
        if (!this._webview || !this._ready)
            return;
        while (this._queue.length > 0) {
            const message = this._queue.shift();
            if (message) {
                this._webview.postMessage(message);
            }
        }
    }
    async _handleReceive(message) {
        if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
            return;
        }
        if (message.method === 'ready') {
            this.markReady();
        }
        const handler = this._handlers?.[message.method];
        if (handler) {
            await handler(message.params || {});
        }
    }
}
//# sourceMappingURL=GraphViewProvider.js.map