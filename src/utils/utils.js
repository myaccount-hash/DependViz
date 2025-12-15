const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { loadControls, typeMatches } = require('./ConfigurationManager');

const WEBVIEW_DIST_PATH = path.join(__dirname, '../../webview/dist/webview.html');

function validateGraphData(data) {
    if (!data || typeof data !== 'object') throw new Error('data must be an object');
    if (!Array.isArray(data.nodes)) throw new Error('data.nodes must be an array');
    if (!Array.isArray(data.links)) throw new Error('data.links must be an array');
}

function validateArray(arr, name) {
    if (!Array.isArray(arr)) throw new Error(`${name} must be an array`);
}

function getWorkspaceFolder() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) throw new Error('ワークスペースが開かれていません');
    return workspaceFolder;
}

function getLinkNodeId(linkNode) {
    return typeof linkNode === 'object' ? linkNode.id : linkNode;
}

function getNodeFilePath(node) {
    return node.filePath || node.file;
}

function computeSlice(data, startNodeId, direction, maxDepth = Infinity) {
    validateGraphData(data);
    const nodeSet = new Set([startNodeId]);
    const linkSet = new Set();
    const visited = new Set();
    const queue = [[startNodeId, 0]];

    while (queue.length > 0) {
        const [nodeId, depth] = queue.shift();
        if (visited.has(nodeId) || depth >= maxDepth) continue;
        visited.add(nodeId);

        data.links.forEach(link => {
            const source = getLinkNodeId(link.source);
            const target = getLinkNodeId(link.target);

            if (direction === 'backward' && target === nodeId && !visited.has(source)) {
                nodeSet.add(source);
                linkSet.add(link);
                queue.push([source, depth + 1]);
            } else if (direction === 'forward' && source === nodeId && !visited.has(target)) {
                nodeSet.add(target);
                linkSet.add(link);
                queue.push([target, depth + 1]);
            }
        });
    }

    return { nodeIds: [...nodeSet], links: [...linkSet] };
}

/**
 * グラフデータをマージ（重複を排除）
 * Java側のCodeGraph.merge()ロジックと同等の処理
 * @param {Object} target - マージ先のグラフデータ
 * @param {Object} source - マージ元のグラフデータ
 */
function mergeGraphData(target, source) {
    if (!source || !source.nodes || !source.links) return;

    // ノードIDからノードへのマップを構築
    const nodeMap = new Map();
    target.nodes.forEach(node => nodeMap.set(node.id, node));

    // 新しいノードを追加、または既存ノードを更新
    source.nodes.forEach(newNode => {
        const existingNode = nodeMap.get(newNode.id);
        if (!existingNode) {
            // 新規ノードを追加
            target.nodes.push(newNode);
            nodeMap.set(newNode.id, newNode);
        } else {
            // 既存ノードのプロパティを更新（Java側のマージロジックと同様）
            // タイプがUnknownの場合は上書き
            if (existingNode.type === 'Unknown' && newNode.type !== 'Unknown') {
                existingNode.type = newNode.type;
            }
            // 行数が-1の場合のみ上書き
            if (existingNode.linesOfCode === -1 && newNode.linesOfCode !== -1) {
                existingNode.linesOfCode = newNode.linesOfCode;
            }
            // ファイルパスがnullの場合のみ上書き
            if (!existingNode.filePath && newNode.filePath) {
                existingNode.filePath = newNode.filePath;
            }
        }
    });

    // リンクの重複チェック用キー生成
    const linkKey = (link) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return `${sourceId}-${link.type}-${targetId}`;
    };

    // 既存リンクのキーセット
    const existingLinkKeys = new Set(target.links.map(linkKey));

    // 新しいリンクを追加
    source.links.forEach(link => {
        const key = linkKey(link);
        if (!existingLinkKeys.has(key)) {
            target.links.push(link);
            existingLinkKeys.add(key);
        }
    });
}

function getHtmlForWebview(webview, libs) {
    const { DEFAULT_CONTROLS, COLORS, DEBUG } = require('../constants');
    const nonce = Date.now().toString();

    if (!fs.existsSync(WEBVIEW_DIST_PATH)) {
        throw new Error('Webview assets not found. Run "npm run build:webview" before packaging the extension.');
    }

    const template = fs.readFileSync(WEBVIEW_DIST_PATH, 'utf8');
    return template
        .replace(/{{nonce}}/g, nonce)
        .replace(/{{cspSource}}/g, webview.cspSource)
        .replace(/{{fgUri}}/g, libs.fgUri)
        .replace(/{{fg3dUri}}/g, libs.fg3dUri)
        .replace(/{{defaultControls}}/g, JSON.stringify(DEFAULT_CONTROLS))
        .replace(/{{colors}}/g, JSON.stringify(COLORS))
        .replace(/{{debug}}/g, JSON.stringify(DEBUG));
}

/**
 * Message creators for webview communication
 */
const messageCreators = {
    update: (payload) => {
        if (!payload || typeof payload !== 'object') {
            throw new Error('update: payload must be an object');
        }
        const { controls, data, stackTracePaths = [] } = payload;
        if (!controls || typeof controls !== 'object') {
            throw new Error('update: controls must be provided');
        }
        validateGraphData(data);
        return {
            type: 'update',
            controls,
            data,
            stackTracePaths: Array.isArray(stackTracePaths) ? stackTracePaths : []
        };
    },

    focusNodeById: (nodeId) => {
        if (nodeId === undefined || nodeId === null) {
            throw new Error('focusNodeById: nodeId is required');
        }
        return { type: 'focusNodeById', nodeId };
    },

    toggle3DMode: () => {
        return { type: 'toggle3DMode' };
    },

    stackTrace: (paths) => {
        if (!Array.isArray(paths)) {
            throw new Error('stackTrace: paths must be an array');
        }
        return { type: 'stackTrace', paths };
    }
};

class WebviewBridge {
    constructor() {
        this._webview = null;
        this._ready = false;
        this._queue = [];
    }

    attach(webview) {
        this._webview = webview;
        this._ready = false;
        this._queue = [];
    }

    detach() {
        this._webview = null;
        this._ready = false;
        this._queue = [];
    }

    markReady() {
        this._ready = true;
        this._flush();
    }

    send(type, ...args) {
        const creator = messageCreators[type];
        if (!creator) {
            throw new Error(`Unknown message type: ${type}`);
        }
        this._dispatch(creator(...args));
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
}

module.exports = {
    validateGraphData,
    validateArray,
    getWorkspaceFolder,
    loadControls,
    typeMatches,
    getLinkNodeId,
    getNodeFilePath,
    getHtmlForWebview,
    computeSlice,
    mergeGraphData,
    WebviewBridge,
    messageCreators
};
