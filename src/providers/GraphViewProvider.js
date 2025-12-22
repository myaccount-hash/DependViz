const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { BaseProvider } = require('./BaseProvider');
const { validateGraphData, getNodeFilePath, mergeGraphData } = require('../utils/utils');
const { ConfigurationManager, COLORS, AUTO_ROTATE_DELAY } = require('../ConfigurationManager');

function isValidMessage(message) {
    return message && message.jsonrpc === '2.0' && typeof message.method === 'string';
}

function createMessageHandlers(provider, bridge) {
    return {
        ready: () => {
            bridge.markReady();
            provider.syncToWebview();
        },
        focusNode: async (params) => {
            if (params.node?.filePath) {
                await vscode.window.showTextDocument(vscode.Uri.file(params.node.filePath));
            }
        }
    };
}

function dispatchMessage(handlers, message) {
    if (!isValidMessage(message)) return;
    const handler = handlers?.[message.method];
    if (handler) {
        return handler(message.params || {});
    }
    if (message.method) {
        console.warn('[GraphViewProvider] Unknown message method:', message.method);
    }
}

function createOutboundParams(type, params) {
    switch (type) {
        case 'graph:update': {
            if (!params || typeof params !== 'object') {
                throw new Error('graph:update: params must be an object');
            }
            const { controls, data, callStackPaths = [], dataVersion } = params;
            if (!controls || typeof controls !== 'object') {
                throw new Error('graph:update: controls must be provided');
            }
            validateGraphData(data);
            const message = {
                controls,
                data,
                callStackPaths: Array.isArray(callStackPaths) ? callStackPaths : []
            };
            if (typeof dataVersion === 'number') {
                message.dataVersion = dataVersion;
            }
            return message;
        }
        case 'view:update': {
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
        }
        case 'node:focus': {
            if (params === undefined || params === null) {
                throw new Error('node:focus: nodeId is required');
            }
            return { nodeId: params };
        }
        case 'mode:toggle':
        case 'focus:clear':
            return undefined;
        default:
            throw new Error(`Unknown message type: ${type}`);
    }
}


/**
 * Graph Viewを提供するTreeDataProvider実装
 * 主にWebviewとの通信を管理する
 */
class GraphViewProvider extends BaseProvider {
    constructor(extensionUri) {
        super();
        this._extensionUri = extensionUri;
        this._view = null;
        this._currentData = { nodes: [], links: [] };
        this._dataVersion = 0;
        this._updateInProgress = false;
        this._pendingUpdate = null;
        this._callStackPaths = [];
        this._webviewBridge = new WebviewBridge(message => {
            return dispatchMessage(this._messageHandlers, message);
        });
        this._messageHandlers = createMessageHandlers(this, this._webviewBridge);
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
        this._webviewBridge.attach(webviewView.webview);
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        webviewView.webview.html = this._getHtmlForWebview();
        this.syncToWebview();
    }

    async refresh() {
        this.syncToWebview();
    }

    mergeGraphData(newData) {
        mergeGraphData(this._currentData, newData);
        this._dataVersion += 1;
        this.syncToWebview();
    }

    setGraphData(data) {
        validateGraphData(data);
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
        } finally {
            this._updateInProgress = false;
        }
    }

    async _performUpdate(data) {
        if (!data || data.type === 'controls') {
            this.syncToWebview({ viewOnly: true });
        } else if (data.type === 'callStack' && Array.isArray(data.paths)) {
            this._callStackPaths = [...data.paths];
            this.syncToWebview({ viewOnly: true });
        } else if (data.type === 'focusNode' && data.filePath) {
            await this.focusNode(data.filePath);
        }
    }

    _findNodeByFilePath(filePath) {
        if (!filePath) return null;
        return this._currentData.nodes.find(n => {
            const nodePath = getNodeFilePath(n);
            if (!nodePath) return false;
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
            : ConfigurationManager.getInstance().loadControls();
        const themeKind = vscode.window.activeColorTheme.kind;
        const darkMode = themeKind === vscode.ColorThemeKind.Dark ||
            themeKind === vscode.ColorThemeKind.HighContrast;

        const payload = {
            controls: { ...controls, darkMode, COLORS, AUTO_ROTATE_DELAY },
            callStackPaths: this._callStackPaths
        };

        if (options.viewOnly) {
            this._sendToWebview('view:update', payload);
            return;
        }

        this._sendToWebview('graph:update', {
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
            this._sendToWebview('node:focus', node.id);
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
            : ConfigurationManager.getInstance().loadControls().is3DMode;
        await ConfigurationManager.getInstance().updateControl('is3DMode', !currentMode);

        // Webviewに通知してグラフをリセット
        this._sendToWebview('mode:toggle');

        // 更新された設定を送信
        this.syncToWebview();
    }

    handleSettingsChanged(controls) {
        super.handleSettingsChanged(controls);
        this.syncToWebview({ viewOnly: true });
    }

    async clearFocus() {
        if (!this._view) return;
        this._sendToWebview('focus:clear');
    }

    _sendToWebview(type, payload) {
        const params = createOutboundParams(type, payload);
        this._webviewBridge.send(type, params);
    }
}

module.exports = GraphViewProvider;

/**
 * Webviewとのメッセージングを管理するクラス
 * ExtensionBridgeと対応する
 * 通信は必ずこのクラスを介して行う
 * GraphViewProviderからのみ使用される
 */
class WebviewBridge {
    constructor(onMessage) {
        this._webview = null;
        this._ready = false;
        this._queue = [];
        this._onMessage = onMessage;
    }

    attach(webview) {
        this._webview = webview;
        this._ready = false;
        this._queue = [];
        if (this._webview?.onDidReceiveMessage) {
            this._webview.onDidReceiveMessage(async message => {
                await this._handleReceive(message);
            });
        }
    }

    detach() {
        this._webview = null;
        this._ready = false;
        this._queue = [];
        this._onMessage = null;
    }

    markReady() {
        this._ready = true;
        this._flush();
    }

    send(method, params) {
        const message = { jsonrpc: '2.0', method };
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
        if (!this._webview || !this._ready) return;
        while (this._queue.length > 0) {
            const message = this._queue.shift();
            this._webview.postMessage(message);
        }
    }

    async _handleReceive(message) {
        if (!this._onMessage) return;
        return this._onMessage(message);
    }
}
