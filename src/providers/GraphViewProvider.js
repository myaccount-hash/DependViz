const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { BaseProvider } = require('./BaseProvider');
const { validateGraphData, mergeGraphData } = require('../utils/graph');
const { COLORS } = require('../configuration/ConfigurationRepository');
const {
    EXTENSION_TO_WEBVIEW,
    WEBVIEW_TO_EXTENSION
} = require('../bridge/MessageTypes');
const WebviewBridge = require('../bridge/WebviewBridge');

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

    registerCommands() {
        return [
            vscode.commands.registerCommand('forceGraphViewer.clearFocus', async () => {
                await this.clearFocus();
            })
        ];
    }

    _handleMessage(message) {
        if (!message?.type) return;

        if (message.type === WEBVIEW_TO_EXTENSION.READY) {
            this._webviewBridge.markReady();
            this.syncToWebview();
        }

        if (message.type === WEBVIEW_TO_EXTENSION.FOCUS_NODE && message.payload?.node?.filePath) {
            vscode.window.showTextDocument(
                vscode.Uri.file(message.payload.node.filePath)
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

    /**
     * データ更新を処理（ノードフォーカスなど）
     * ConfigurationObserverのupdate(controls)とは異なる
     *
     * @param {Object} data - 更新データ
     */
    async handleDataUpdate(data) {
        this._updateQueue.push(data);
        if (this._updating) return;

        this._updating = true;
        try {
            while (this._updateQueue.length) {
                await this._applyDataUpdate(this._updateQueue.shift());
            }
        } finally {
            this._updating = false;
        }
    }

    async _applyDataUpdate(data) {
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
                COLORS
            }
        };

        if (options.viewOnly) {
            this._sendToWebview(EXTENSION_TO_WEBVIEW.VIEW_UPDATE, payload);
            return;
        }

        this._sendToWebview(EXTENSION_TO_WEBVIEW.GRAPH_UPDATE, {
            ...payload,
            data: this._data,
            dataVersion: this._dataVersion
        });
    }

    async focusNode(filePath) {
        if (!this._view) return;
        const node = this._findNodeByFilePath(filePath);
        if (node) {
            this._sendToWebview(EXTENSION_TO_WEBVIEW.NODE_FOCUS, { nodeId: node.id });
        }
    }

    handleSettingsChanged(controls) {
        super.handleSettingsChanged(controls);
        this.syncToWebview({ viewOnly: true });
    }

    async clearFocus() {
        if (!this._view) return;
        this._sendToWebview(EXTENSION_TO_WEBVIEW.FOCUS_CLEAR);
    }

    _sendToWebview(type, payload) {
        this._webviewBridge.send(type, payload);
    }
}

module.exports = GraphViewProvider;
