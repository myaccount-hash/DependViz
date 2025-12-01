const vscode = require('vscode');
const { CDN_LIBS } = require('../constants');
const { getHtmlForWebview, getGraphPath, loadControls, typeMatches, validateGraphData, getLinkNodeId, getNodeFilePath, computeSlice } = require('../utils/utils');
const QueryParser = require('../utils/QueryParser');
const fs = require('fs');

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
        this._forwardSlice = null;
        this._backwardSlice = null;
        this._stackTracePaths = [];
        this._lastFocusedFilePath = null;
    }

    async resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        webviewView.webview.html = getHtmlForWebview(webviewView.webview, CDN_LIBS);
        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.type === 'focusNode' && message.node?.filePath) {
                await vscode.window.showTextDocument(vscode.Uri.file(message.node.filePath));
            }
        });
        await this.reloadGraphData();
    }

    async refresh() {
        await this.reloadGraphData();
    }

    async reloadGraphData() {
        const graphPath = getGraphPath();
        if (fs.existsSync(graphPath)) {
            await this.loadData(vscode.Uri.file(graphPath));
            this.syncToWebview();
        }
    }

    async loadData(uri) {
        try {
            const data = await vscode.workspace.fs.readFile(uri);
            this._currentData = JSON.parse(data.toString());
            return this._currentData;
        } catch (e) {
            console.error('Failed to load graph data:', e);
            vscode.window.showErrorMessage(`グラフデータの読み込みに失敗しました: ${e.message}`);
            throw e;
        }
    }

    update(data) {
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
            return this.focusNode(data.filePath);
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
        const controls = loadControls();
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

        const controls = loadControls();
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
            const controls = loadControls();
            const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
                          vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;
            this._view.webview.postMessage({
                type: 'update',
                controls: { ...controls, darkMode: isDark },
                data: this.getFilteredData(),
                stackTracePaths: this._stackTracePaths
            });
        }
    }

    getFilteredData() {
        const controls = loadControls();
        return this._filter.apply(
            this._currentData,
            controls,
            this._forwardSlice,
            this._backwardSlice
        );
    }

    async focusNode(filePath) {
        this._lastFocusedFilePath = filePath;

        const fileUri = vscode.Uri.file(filePath);
        const fileWorkspace = vscode.workspace.getWorkspaceFolder(fileUri);

        if (fileWorkspace && this._currentData?.nodes?.length > 0) {
            const firstNodePath = getNodeFilePath(this._currentData.nodes[0]);
            const dataInCorrectWorkspace = firstNodePath && firstNodePath.startsWith(fileWorkspace.uri.fsPath);

            if (!dataInCorrectWorkspace) {
                await this.reloadGraphData();
            }
        }

        if (this._view && this._currentData?.nodes?.length > 0) {
            const node = this._findNodeByFilePath(filePath);
            if (node) {
                const controls = loadControls();
                if (controls.enableForwardSlice) {
                    this._computeSliceForFilePath(filePath, 'forward');
                }
                if (controls.enableBackwardSlice) {
                    this._computeSliceForFilePath(filePath, 'backward');
                }

                this.syncToWebview();
                this._view.webview.postMessage({ type: 'focusNodeById', nodeId: node.id });
            }
        }
    }

}

module.exports = GraphViewProvider;
