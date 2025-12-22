function validateGraphData(data) {
    if (!data || typeof data !== 'object') throw new Error('data must be an object');
    if (!Array.isArray(data.nodes)) throw new Error('data.nodes must be an array');
    if (!Array.isArray(data.links)) throw new Error('data.links must be an array');
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

module.exports = {
    validateGraphData,
    mergeGraphData
};
