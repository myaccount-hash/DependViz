const vscode = require('vscode');
const { CDN_LIBS } = require('../constants');
const { getHtmlForWebview, typeMatches, validateGraphData, getLinkNodeId, getNodeFilePath, computeSlice, mergeGraphData } = require('../utils/utils');
const { ConfigurationManager } = require('../utils/ConfigurationManager');
const QueryParser = require('../utils/QueryParser');

class GraphDataFilter {
    bySearch(nodes, search) { return QueryParser.filter(nodes, search); }
    byNodeType(nodes, controls) { return nodes.filter(n => typeMatches(n.type, controls, 'node')); }
    byEdgeType(links, controls) { return links.filter(l => typeMatches(l.type, controls, 'edge')); }
    byConnectedNodes(links, nodeIds) { return links.filter(l => nodeIds.has(getLinkNodeId(l.source)) && nodeIds.has(getLinkNodeId(l.target))); }
    isolatedNodes(nodes, links) {
        const connected = new Set();
        links.forEach(l => { connected.add(getLinkNodeId(l.source)); connected.add(getLinkNodeId(l.target)); });
        return nodes.filter(n => connected.has(n.id));
    }
    apply(data, controls, forwardSlice = null, backwardSlice = null) {
        validateGraphData(data);
        if (!controls || typeof controls !== 'object') throw new Error('controls must be an object');

        let workingNodes = data.nodes;
        let workingLinks = data.links;

        if (forwardSlice || backwardSlice) {
            const nodeIds = new Set();
            const linkSet = new Set();

            if (forwardSlice) {
                forwardSlice.nodeIds.forEach(id => nodeIds.add(id));
                forwardSlice.links.forEach(link => linkSet.add(link));
            }
            if (backwardSlice) {
                backwardSlice.nodeIds.forEach(id => nodeIds.add(id));
                backwardSlice.links.forEach(link => linkSet.add(link));
            }

            workingNodes = data.nodes.filter(n => nodeIds.has(n.id));
            workingLinks = Array.from(linkSet);
        }

        let nodes = this.byNodeType(this.bySearch(workingNodes, controls.search), controls);
        const nodeIds = new Set(nodes.map(n => n.id));
        let links = this.byConnectedNodes(this.byEdgeType(workingLinks, controls), nodeIds);
        if (controls.hideIsolatedNodes) nodes = this.isolatedNodes(nodes, links);
        return { nodes, links };
    }
}

class GraphViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        this._view = null;
        this._currentData = { nodes: [], links: [] };
        this._filter = new GraphDataFilter();
        this._updateInProgress = false;
        this._pendingUpdate = null;
        this._messageQueue = [];
        this._webviewReady = false;
        this._forwardSlice = null;
        this._backwardSlice = null;
        this._stackTracePaths = [];
        this._lastFocusedFilePath = null;
    }

    async resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;
        this._webviewReady = false;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        webviewView.webview.html = getHtmlForWebview(webviewView.webview, CDN_LIBS);
        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.type === 'ready') {
                // Webviewの準備完了
                this._webviewReady = true;
                this._flushMessageQueue();
            } else if (message.type === 'focusNode' && message.node?.filePath) {
                await vscode.window.showTextDocument(vscode.Uri.file(message.node.filePath));
            }
        });
        this.syncToWebview();
    }

    _flushMessageQueue() {
        if (this._webviewReady && this._view) {
            while (this._messageQueue.length > 0) {
                const message = this._messageQueue.shift();
                this._view.webview.postMessage(message);
            }
        }
    }

    _postMessage(message) {
        if (!this._view) return false;

        if (this._webviewReady) {
            this._view.webview.postMessage(message);
            return true;
        } else {
            // Webview準備中はキューに追加
            this._messageQueue.push(message);
            return false;
        }
    }

    async refresh() {
        this._applySliceSettings();
        this.syncToWebview();
    }

    /**
     * グラフデータをインクリメンタルにマージ
     * 既存のノード・リンクと新しいデータを統合
     * @param {Object} newData - 追加するグラフデータ { nodes, links }
     */
    mergeGraphData(newData) {
        mergeGraphData(this._currentData, newData);
        this.syncToWebview();
    }

    /**
     * グラフデータ全体を置き換える
     * @param {Object} data - 完全なグラフデータ { nodes, links }
     */
    setGraphData(data) {
        validateGraphData(data);
        this._currentData = {
            nodes: data.nodes ?? [],
            links: data.links ?? []
        };
        this.syncToWebview();
    }

    async update(data) {
        // 更新処理中の場合、最新の更新を保持
        if (this._updateInProgress) {
            this._pendingUpdate = data;
            return;
        }

        this._updateInProgress = true;

        try {
            await this._performUpdate(data);

            // 保留中の更新があれば処理
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
            // 設定更新
            this._applySliceSettings();
            this.syncToWebview();
        } else if (data.type === 'stackTrace' && Array.isArray(data.paths)) {
            // スタックトレース更新
            this._stackTracePaths = [...data.paths];
            this.syncToWebview();
        } else if (data.type === 'focusNode' && data.filePath) {
            // ノードフォーカス
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

    _applySliceSettings() {
        const controls = ConfigurationManager.getInstance().loadControls();
        const { enableForwardSlice, enableBackwardSlice } = controls;

        if (!enableForwardSlice) this._forwardSlice = null;
        if (!enableBackwardSlice) this._backwardSlice = null;

        if (this._lastFocusedFilePath) {
            if (enableForwardSlice && !this._forwardSlice) {
                this._computeSliceForFilePath(this._lastFocusedFilePath, 'forward');
            }
            if (enableBackwardSlice && !this._backwardSlice) {
                this._computeSliceForFilePath(this._lastFocusedFilePath, 'backward');
            }
        }
    }

    _computeSliceForFilePath(filePath, direction) {
        const node = this._findNodeByFilePath(filePath);
        if (!node) return;

        const controls = ConfigurationManager.getInstance().loadControls();
        const maxDepth = controls.sliceDepth || Infinity;
        const slice = computeSlice(this._currentData, node.id, direction, maxDepth);
        const sliceData = { ...slice, maxDepth };

        if (direction === 'forward') {
            this._forwardSlice = sliceData;
        } else if (direction === 'backward') {
            this._backwardSlice = sliceData;
        }
    }

    syncToWebview() {
        if (this._view) {
            const controls = ConfigurationManager.getInstance().loadControls();
            const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
                          vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;
            const data = this.getFilteredData();
            this._postMessage({
                type: 'update',
                controls: { ...controls, darkMode: isDark },
                data: data,
                stackTracePaths: this._stackTracePaths
            });
        } else {
            console.warn('[GraphViewProvider] Cannot sync - view not available');
        }
    }

    getFilteredData() {
        const controls = ConfigurationManager.getInstance().loadControls();
        return this._filter.apply(
            this._currentData,
            controls,
            this._forwardSlice,
            this._backwardSlice
        );
    }

    async focusNode(filePath) {
        this._lastFocusedFilePath = filePath;

        if (this._view && this._currentData?.nodes?.length > 0) {
            const node = this._findNodeByFilePath(filePath);
            if (node) {
                const controls = ConfigurationManager.getInstance().loadControls();
                if (controls.enableForwardSlice) {
                    this._computeSliceForFilePath(filePath, 'forward');
                }
                if (controls.enableBackwardSlice) {
                    this._computeSliceForFilePath(filePath, 'backward');
                }

                this.syncToWebview();
                this._postMessage({ type: 'focusNodeById', nodeId: node.id });
            }
        }
    }

}

module.exports = GraphViewProvider;
