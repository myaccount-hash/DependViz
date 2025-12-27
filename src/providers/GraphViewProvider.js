const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { BaseProvider } = require('./BaseProvider');
const { validateGraphData, mergeGraphData } = require('../utils/graph');
const { ConfigurationManager, COLORS, AUTO_ROTATE_DELAY } = require('../ConfigurationManager');

const outbound = {
    'graph:update': ({ controls, data, dataVersion }) => {
        validateGraphData(data);
        return {
            controls,
            data,
            ...(typeof dataVersion === 'number' && { dataVersion })
        };
    },
    'view:update': ({ controls }) => ({
        ...(controls && { controls })
    }),
    'node:focus': nodeId => ({ nodeId }),
    'focus:clear': () => undefined
};

function createOutboundParams(type, params) {
    const fn = outbound[type];
    if (!fn) {
        throw new Error(`Unknown message type: ${type}`);
    }
    return fn(params);
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
        this._data = { nodes: [], links: [] };
        this._dataVersion = 0;

        this._updateQueue = [];
        this._updating = false;

        this._webviewBridge = new WebviewBridge(m => this._handleMessage(m));
    }

    _handleMessage(message) {
        if (!message || message.jsonrpc !== '2.0') return;

        if (message.method === 'ready') {
            this._webviewBridge.markReady();
            this.syncToWebview();
        }

        if (message.method === 'focusNode' && message.params?.node?.filePath) {
            vscode.window.showTextDocument(
                vscode.Uri.file(message.params.node.filePath)
            );
        }
    }

    _getHtmlForWebview() {
        const htmlPath = path.join(__dirname, '../../webview/dist/index.html');
        if (!fs.existsSync(htmlPath)) {
            throw new Error(
                'Webview HTML not found. Run "npm run build:webview" before packaging the extension.'
            );
        }
        return fs.readFileSync(htmlPath, 'utf8');
    }

    async resolveWebviewView(webviewView) {
        this._view = webviewView;
        this._webviewBridge.attach(webviewView.webview);
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview();
        this.syncToWebview();
    }

    mergeGraphData(newData) {
        mergeGraphData(this._data, newData);
        this._dataVersion++;
        this.syncToWebview();
    }

    setGraphData(data) {
        validateGraphData(data);
        this._data = {
            nodes: data.nodes ?? [],
            links: data.links ?? []
        };
        this._dataVersion++;
        this.syncToWebview();
    }

    async update(data) {
        this._updateQueue.push(data);
        if (this._updating) return;

        this._updating = true;
        try {
            while (this._updateQueue.length) {
                await this._applyUpdate(this._updateQueue.shift());
            }
        } finally {
            this._updating = false;
        }
    }

    async _applyUpdate(data) {
        if (data?.type === 'focusNode' && data.filePath) {
            this.focusNode(data.filePath);
        }
    }

    _findNodeByFilePath(filePath) {
        if (!filePath) return null;
        return this._data.nodes.find(n =>
            n.filePath && filePath.endsWith(n.filePath)
        );
    }

    syncToWebview(options = {}) {
        if (!this._view) return;

        const themeKind = vscode.window.activeColorTheme.kind;
        const darkMode =
            themeKind === vscode.ColorThemeKind.Dark ||
            themeKind === vscode.ColorThemeKind.HighContrast;

        const payload = {
            controls: {
                ...this.controls,
                darkMode,
                COLORS,
                autoRotateDelay: AUTO_ROTATE_DELAY
            }
        };

        if (options.viewOnly) {
            this._sendToWebview('view:update', payload);
            return;
        }

        this._sendToWebview('graph:update', {
            ...payload,
            data: this._data,
            dataVersion: this._dataVersion
        });
    }

    async focusNode(filePath) {
        if (!this._view) return;
        const node = this._findNodeByFilePath(filePath);
        if (node) {
            this._sendToWebview('node:focus', node.id);
        }
    }

    async toggle3DMode() {
        const cfg = ConfigurationManager.getInstance();
        await cfg.updateControl('is3DMode', !this.controls.is3DMode);
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
        this._queue.length = 0;

        if (webview?.onDidReceiveMessage) {
            webview.onDidReceiveMessage(m => this._onMessage?.(m));
        }
    }

    markReady() {
        this._ready = true;
        while (this._queue.length) {
            this._webview.postMessage(this._queue.shift());
        }
    }

    send(method, params) {
        const message = {
            jsonrpc: '2.0',
            method,
            ...(params !== undefined && { params })
        };

        if (!this._webview) return;
        this._ready
            ? this._webview.postMessage(message)
            : this._queue.push(message);
    }
}
