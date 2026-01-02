/**
 * グラフデータの状態を管理するクラス
 * ノード/リンクのデータ、バージョン管理、ノード間の関係性を保持
 */
class GraphModel {
  /**
   * GraphModelを初期化
   */
  constructor() {
    this._nodes = [];
    this._links = [];
    this._version = 0;
    this._nodeById = new Map();
  }

  /**
   * グラフデータを更新
   * @param {Object} data - グラフデータ
   * @param {Array} data.nodes - ノード配列
   * @param {Array} data.links - リンク配列
   * @param {number} version - データバージョン（省略時は自動インクリメント）
   */
  update(data, version) {
    this._nodes = this._preprocessNodes(data.nodes || []);
    this._links = this._preprocessLinks(data.links || []);
    this._version = typeof version === 'number' ? version : this._version + 1;
  }

  /**
   * ノードIDでノードを検索
   * @param {string|number} nodeId - ノードID
   * @returns {Object|undefined} ノード、または見つからない場合undefined
   */
  findNode(nodeId) {
    return this._nodeById.get(nodeId);
  }

  /**
   * 全ノードを取得
   * @returns {Array} ノード配列
   */
  get nodes() { return this._nodes; }

  /**
   * 全リンクを取得
   * @returns {Array} リンク配列
   */
  get links() { return this._links; }

  /**
   * 現在のデータバージョンを取得
   * @returns {number} バージョン番号
   */
  get version() { return this._version; }

  /**
   * ノードを前処理
   * 各ノードにneighbors/linksプロパティを追加し、ID->ノードマップを構築
   * @param {Array} nodes - ノード配列
   * @returns {Array} 前処理済みノード配列
   * @private
   */
  _preprocessNodes(nodes) {
    const processed = [...nodes];
    this._nodeById.clear();
    processed.forEach(node => {
      node.neighbors = [];
      node.links = [];
      if (node.id != null) {
        this._nodeById.set(node.id, node);
      }
    });
    return processed;
  }

  /**
   * リンクを前処理
   * 各ノードのneighbors/linksプロパティに関連ノード/リンクを追加
   * @param {Array} links - リンク配列
   * @returns {Array} 前処理済みリンク配列
   * @private
   */
  _preprocessLinks(links) {
    const processed = [...links];
    processed.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const a = this._nodeById.get(sourceId);
      const b = this._nodeById.get(targetId);
      if (!a || !b) return;
      a.neighbors.push(b);
      b.neighbors.push(a);
      a.links.push(link);
      b.links.push(link);
    });
    return processed;
  }
}

export { GraphModel };