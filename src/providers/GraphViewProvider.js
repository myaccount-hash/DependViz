const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { BaseProvider } = require('./BaseProvider');
const { validateGraphData, getNodeFilePath, mergeGraphData } = require('../utils/utils');
const { ConfigurationManager, COLORS, AUTO_ROTATE_DELAY } = require('../ConfigurationManager');



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
        this._webviewBridge = new WebviewBridge();
    }

    _getHtmlForWebview() {
        const htmlPath = path.join(__dirname, '../../webview/dist/index.html');
        if (!fs.existsSync(htmlPath)) {
            throw new Error('Webview HTML not found. Run "npm run build:webview" before packaging the extension.');
        }
        return fs.readFileSync(htmlPath, 'utf8');
    }

    async resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;
        this._webviewBridge.attach(webviewView.webview, {
            ready: () => {
                this.syncToWebview();
            },
            focusNode: async (message) => {
                if (message.node?.filePath) {
                    await vscode.window.showTextDocument(vscode.Uri.file(message.node.filePath));
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
            : ConfigurationManager.getInstance().loadControls({ ignoreCache: true });
        const themeKind = vscode.window.activeColorTheme.kind;
        const darkMode = themeKind === vscode.ColorThemeKind.Dark ||
            themeKind === vscode.ColorThemeKind.HighContrast;

        const payload = {
            controls: { ...controls, darkMode, COLORS, AUTO_ROTATE_DELAY },
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
            : ConfigurationManager.getInstance().loadControls({ ignoreCache: true }).is3DMode;
        await ConfigurationManager.getInstance().updateControl('is3DMode', !currentMode);

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
        if (!this._view) return;
        this._webviewBridge.send('focus:clear');
    }
}

module.exports = GraphViewProvider;
const messageCreators = {
    'graph:update': payload => {
        if (!payload || typeof payload !== 'object') {
            throw new Error('graph:update: payload must be an object');
        }
        const { controls, data, callStackPaths = [], dataVersion } = payload;
        if (!controls || typeof controls !== 'object') {
            throw new Error('graph:update: controls must be provided');
        }
        validateGraphData(data);
        const message = {
            type: 'graph:update',
            payload: {
                controls,
                data,
                callStackPaths: Array.isArray(callStackPaths) ? callStackPaths : []
            }
        };
        if (typeof dataVersion === 'number') {
            message.payload.dataVersion = dataVersion;
        }
        return message;
    },

    'view:update': payload => {
        const validPayload = payload && typeof payload === 'object' ? payload : null;
        if (!validPayload) {
            throw new Error('view:update: payload must be an object');
        }
        const message = { type: 'view:update', payload: {} };

        if (validPayload.controls && typeof validPayload.controls === 'object') {
            message.payload.controls = validPayload.controls;
        }
        if (Array.isArray(validPayload.callStackPaths)) {
            message.payload.callStackPaths = validPayload.callStackPaths;
        }
        return message;
    },

    'node:focus': nodeId => {
        if (nodeId === undefined || nodeId === null) {
            throw new Error('node:focus: nodeId is required');
        }
        return { type: 'node:focus', payload: { nodeId } };
    },

    'mode:toggle': () => {
        return { type: 'mode:toggle', payload: {} };
    },

    'focus:clear': () => {
        return { type: 'focus:clear', payload: {} };
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
    }

    attach(webview, handlers = {}) {
        this._webview = webview;
        this._ready = false;
        this._queue = [];
        this._handlers = handlers;
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
        this._handlers = null;
    }

    markReady() {
        this._ready = true;
        this._flush();
    }

    send(type, payload) {
        const creator = messageCreators[type];
        if (!creator) {
            throw new Error(`Unknown message type: ${type}`);
        }
        this._dispatch(creator(payload));
    }

    _dispatch(message) {
        if (!message || typeof message.type !== 'string') {
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
        if (!message || typeof message.type !== 'string') {
            return;
        }
        if (message.type === 'ready') {
            this.markReady();
        }
        const handler = this._handlers?.[message.type];
        if (handler) {
            await handler(message);
        }
    }
}
