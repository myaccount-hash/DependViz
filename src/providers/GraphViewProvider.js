const vscode = require('vscode');
const { getHtmlForWebview, validateGraphData, getNodeFilePath, mergeGraphData, WebviewBridge } = require('../utils/utils');
const { ConfigurationManager } = require('../utils/ConfigurationManager');

class GraphViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        this._view = null;
        this._currentData = { nodes: [], links: [] };
        this._dataVersion = 0;
        this._updateInProgress = false;
        this._pendingUpdate = null;
        this._stackTracePaths = [];
        this._webviewBridge = new WebviewBridge();
    }

    async resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;
        this._webviewBridge.attach(webviewView.webview);
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        webviewView.webview.html = getHtmlForWebview();
        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.type === 'ready') {
                this._webviewBridge.markReady();
                this.syncToWebview();
            } else if (message.type === 'focusNode' && message.node?.filePath) {
                await vscode.window.showTextDocument(vscode.Uri.file(message.node.filePath));
            }
        });
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
            this.syncToWebview();
        } else if (data.type === 'stackTrace' && Array.isArray(data.paths)) {
            this._stackTracePaths = [...data.paths];
            this.syncToWebview();
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

    syncToWebview() {
        if (!this._view) {
            console.warn('[GraphViewProvider] Cannot sync - view not available');
            return;
        }

        const controls = ConfigurationManager.getInstance().loadControls();
        const themeKind = vscode.window.activeColorTheme.kind;
        const darkMode = themeKind === vscode.ColorThemeKind.Dark ||
            themeKind === vscode.ColorThemeKind.HighContrast;

        this._webviewBridge.send('update', {
            controls: { ...controls, darkMode },
            data: this._currentData,
            dataVersion: this._dataVersion,
            stackTracePaths: this._stackTracePaths
        });
    }

    async focusNode(filePath) {
        if (!this._view || !this._currentData?.nodes?.length) {
            return;
        }
        const node = this._findNodeByFilePath(filePath);
        if (node) {
            this._webviewBridge.send('focusNodeById', node.id);
        }
    }

    async toggle3DMode() {
        if (!this._view) {
            console.warn('[GraphViewProvider] Cannot toggle 3D mode - view not available');
            return;
        }

        // 現在の設定を取得して反転
        const currentMode = ConfigurationManager.getInstance().loadControls().is3DMode;
        await ConfigurationManager.getInstance().updateControl('is3DMode', !currentMode);

        // Webviewに通知してグラフをリセット
        this._webviewBridge.send('toggle3DMode');

        // 更新された設定を送信
        this.syncToWebview();
    }

    async clearFocus() {
        if (!this._view) return;
        this._webviewBridge.send('clearFocus');
    }
}

module.exports = GraphViewProvider;
