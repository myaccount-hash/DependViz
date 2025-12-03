const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { loadControls, typeMatches } = require('./ConfigurationManager');

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
    const script = fs.readFileSync(path.join(__dirname, '../webview/script.js'), 'utf8');
    const wrappedScript = `(function(DEFAULT_CONTROLS, COLORS, DEBUG) {\n${script}\n})(DEFAULT_CONTROLS, COLORS, DEBUG);`;
    const template = fs.readFileSync(path.join(__dirname, '../webview/template.html'), 'utf8');
    return template
        .replace(/{{nonce}}/g, nonce)
        .replace(/{{cspSource}}/g, webview.cspSource)
        .replace(/{{fgUri}}/g, libs.fgUri)
        .replace(/{{defaultControls}}/g, JSON.stringify(DEFAULT_CONTROLS))
        .replace(/{{colors}}/g, JSON.stringify(COLORS))
        .replace(/{{debug}}/g, JSON.stringify(DEBUG))
        .replace(/{{script}}/g, wrappedScript);
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
    mergeGraphData
};
