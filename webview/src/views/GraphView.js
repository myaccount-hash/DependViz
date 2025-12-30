/**
 * グラフのレンダリングと視覚属性計算を管理する基底クラス
 * Strategyパターン: Strategy（戦略）インターフェース
 * - 2D/3Dレンダラーの共通機能を提供
 * - 各サブクラスが具体的なレンダリング戦略を実装
 */
class GraphView {
  /**
   * GraphViewを初期化
   * @param {Object} options - オプション
   * @param {Function} options.onNodeClick - ノードクリック時のコールバック関数
   */
  constructor(options = {}) {
    this.callbacks = {
      onNodeClick: options.onNodeClick || null
    };

    this.nodeRules = [
      (node, ctx) => {
        const color = this._getTypeColor(ctx, 'node', node.type);
        return color ? { color } : null;
      },
      (node, ctx) => ctx.controls.nodeSizeByLoc && node.linesOfCode > 0 && {
        sizeMultiplier: Math.max(1, Math.pow(node.linesOfCode, 0.7))
      }
    ];

    this.linkRules = [
      (link, ctx) => {
        const color = this._getTypeColor(ctx, 'edge', link.type);
        return color ? { color } : null;
      }
    ];
  }

  /**
   * ノード/エッジタイプに対応する色を取得
   * @param {Object} ctx - レンダリングコンテキスト
   * @param {string} category - カテゴリ（'node'または'edge'）
   * @param {string} type - タイプ名
   * @returns {string|null} 色コード、または設定がない場合null
   * @private
   */
  _getTypeColor(ctx, category, type) {
    if (!type) return null;
    const map = ctx.controls.typeColors?.[category];
    if (!map) return null;
    const color = map[type];
    return typeof color === 'string' && color.length > 0 ? color : null;
  }

  /**
   * ルール配列を適用してプロパティを計算
   * @param {Object} item - 適用対象のアイテム（ノードまたはリンク）
   * @param {Array<Function>} rules - ルール関数の配列
   * @param {Object} defaults - デフォルトプロパティ
   * @param {Object} ctx - レンダリングコンテキスト
   * @returns {Object} 計算されたプロパティ
   * @private
   */
  _applyRules(item, rules, defaults, ctx) {
    const result = { ...defaults };
    for (const rule of rules) {
      const ruleResult = rule(item, ctx);
      if (ruleResult) Object.assign(result, ruleResult);
    }
    return result;
  }

  /**
   * ノードの視覚属性を計算
   * タイプ別の色、サイズ、透明度などを決定
   * @param {Object} node - ノードデータ
   * @param {Object} ctx - レンダリングコンテキスト
   * @returns {Object} 視覚属性（color、size、opacity、labelなど）
   */
  getNodeVisualProps(node, ctx) {
    const COLORS = ctx.controls.COLORS || {};
    let label = node.name || node.id || '';
    if (node.name && ctx.controls.shortNames) {
      const lastDot = node.name.lastIndexOf('.');
      label = lastDot !== -1 ? node.name.substring(lastDot + 1) : node.name;
    }
    const props = this._applyRules(node, this.nodeRules, {
      color: COLORS.NODE_DEFAULT || '#93c5fd',
      sizeMultiplier: 1,
      label,
      opacity: ctx.controls.nodeOpacity
    }, ctx);

    const hasSlice = ctx.ui.sliceNodes && ctx.ui.sliceNodes.size > 0;

    if (hasSlice) {
      if (!ctx.ui.sliceNodes.has(node.id)) {
        props.opacity = (props.opacity || 1) * 0.1;
      }
    } else if (ctx.ui.focusedNode &&
               (ctx.controls.enableForwardSlice || ctx.controls.enableBackwardSlice)) {
      const isFocused = node.id === ctx.ui.focusedNode.id;
      const isNeighbor = ctx.ui.focusedNode.neighbors &&
                         ctx.ui.focusedNode.neighbors.some(n => n.id === node.id);

      if (!isFocused && !isNeighbor) {
        const dim = ctx.controls.dimOpacity ?? 0.2;
        props.opacity = (props.opacity || 1) * dim;
      }
    }

    return {
      ...props,
      size: (props.sizeMultiplier || 1) * ctx.controls.nodeSize
    };
  }

  /**
   * リンクの視覚属性を計算
   * タイプ別の色、幅、透明度などを決定
   * @param {Object} link - リンクデータ
   * @param {Object} ctx - レンダリングコンテキスト
   * @returns {Object} 視覚属性（color、width、opacityなど）
   */
  getLinkVisualProps(link, ctx) {
    const COLORS = ctx.controls.COLORS || {};
    const props = this._applyRules(link, this.linkRules, {
      color: COLORS.EDGE_DEFAULT || '#4b5563',
      widthMultiplier: 1,
      opacity: ctx.controls.edgeOpacity
    }, ctx);

    const hasSlice = ctx.ui.sliceNodes && ctx.ui.sliceNodes.size > 0;

    if (hasSlice) {
      const inSlice = ctx.ui.sliceLinks ? ctx.ui.sliceLinks.has(link) : false;
      if (inSlice) {
        props.widthMultiplier = (props.widthMultiplier || 1) * 1.5;
      } else {
        props.opacity = (props.opacity || 1) * 0.1;
      }
    } else if (ctx.ui.focusedNode &&
               (ctx.controls.enableForwardSlice || ctx.controls.enableBackwardSlice)) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const focusedId = ctx.ui.focusedNode.id;

      const isConnectedToFocus = sourceId === focusedId || targetId === focusedId;

      if (isConnectedToFocus) {
        props.widthMultiplier = (props.widthMultiplier || 1) * 1.5;
      } else {
        const dim = ctx.controls.dimOpacity ?? 0.2;
        props.opacity = (props.opacity || 1) * dim;
      }
    }

    return {
      ...props,
      width: (props.widthMultiplier || 1) * ctx.controls.linkWidth
    };
  }

  /**
   * ノードラベルを適用または削除
   * @param {Object} ctx - レンダリングコンテキスト
   * @param {Function} getNodeProps - ノードプロパティ取得関数
   * @private
   */
  _applyLabels(ctx, getNodeProps) {
    const labelRenderer = this.createLabelRenderer(ctx);
    if (ctx.controls.showNames) {
      labelRenderer.apply(ctx.graph, getNodeProps, ctx);
    } else {
      labelRenderer.clear(ctx.graph, ctx);
    }
  }

  /**
   * ノードとリンクの色を適用
   * @param {Object} ctx - レンダリングコンテキスト
   * @param {Function} getNodeProps - ノードプロパティ取得関数
   * @param {Function} getLinkProps - リンクプロパティ取得関数
   * @private
   */
  _applyColors(ctx, getNodeProps, getLinkProps) {
    const COLORS = ctx.controls.COLORS || {};
    ctx.graph
      .nodeColor(node => {
        const props = getNodeProps(node);
        const color = props ? props.color : (COLORS.NODE_DEFAULT || '#93c5fd');
        return applyOpacityToColor(color, props?.opacity);
      })
      .linkColor(link => {
        const props = getLinkProps(link);
        const color = props ? props.color : (COLORS.EDGE_DEFAULT || '#4b5563');
        return applyOpacityToColor(color, props?.opacity);
      });
  }

  /**
   * グラフ全体を更新（データと視覚属性）
   * @param {Object} ctx - レンダリングコンテキスト
   * @param {Object} options - 更新オプション
   * @param {boolean} options.reheatSimulation - シミュレーションを再加熱するか
   */
  updateGraph(ctx, options = {}) {
    const { reheatSimulation = false } = options;

    if (!ctx.graph) {
      console.error('[DependViz] Graph not initialized');
      return;
    }

    ctx.graph.backgroundColor(ctx.getBackgroundColor());

    const nodes = ctx.data.nodes || [];
    const links = ctx.data.links || [];
    const getNodeProps = node => this.getNodeVisualProps(node, ctx);
    const getLinkProps = link => this.getLinkVisualProps(link, ctx);

    const filteredData = this._applyFilter(nodes, links, ctx);
    ctx.graph.graphData(filteredData);

    this._applyLabels(ctx, getNodeProps);

    ctx.graph
      .nodeLabel(node => {
        const props = getNodeProps(node);
        return props ? props.label : node.name || node.id;
      })
      .nodeVal(node => {
        const props = getNodeProps(node);
        return props ? props.size : ctx.controls.nodeSize;
      })
      .linkWidth(link => {
        const props = getLinkProps(link);
        return props ? props.width : ctx.controls.linkWidth;
      })
      .linkDirectionalArrowLength(ctx.controls.arrowSize);

    this._applyColors(ctx, getNodeProps, getLinkProps);

    const enableForceLayout = ctx.controls.enableForceLayout !== false;
    if (enableForceLayout) {
      ctx.graph.resumeAnimation?.();

      const linkForce = ctx.graph.d3Force('link');
      if (linkForce) linkForce.distance(ctx.controls.linkDistance);

      // ノードの大きさに応じて斥力を調整
      const chargeForce = ctx.graph.d3Force('charge');
      if (chargeForce) {
        chargeForce.strength(node => {
          const props = getNodeProps(node);
          const size = props ? props.size : ctx.controls.nodeSize;
          // ノードのサイズが大きいほど斥力を強くする
          const baseStrength = -30;
          return baseStrength * (size / ctx.controls.nodeSize);
        });
      }

      if (reheatSimulation && ctx.graph?.d3ReheatSimulation) {
        setTimeout(() => ctx.graph.d3ReheatSimulation(), 100);
      }
    } else {
      ctx.graph.pauseAnimation?.();
    }

    this.onGraphUpdated(ctx);
  }

  /**
   * 視覚属性のみを更新（データ構造は変更しない）
   * @param {Object} ctx - レンダリングコンテキスト
   */
  updateVisuals(ctx) {
    if (!ctx.graph) return;

    const getNodeProps = node => this.getNodeVisualProps(node, ctx);
    const getLinkProps = link => this.getLinkVisualProps(link, ctx);

    this._applyLabels(ctx, getNodeProps);
    this._applyColors(ctx, getNodeProps, getLinkProps);
  }

  /**
   * グラフを初期化
   * コンテナにグラフインスタンスを作成し、基本設定を適用
   * @param {HTMLElement} container - グラフを表示するコンテナ要素
   * @param {Object} ctx - レンダリングコンテキスト
   * @returns {Object|null} グラフインスタンス、またはエラー時null
   */
  initializeGraph(container, ctx) {
    if (!container) {
      console.error('[DependViz] Container not found!');
      return null;
    }

    if (!this.checkLibraryAvailability()) {
      console.error(`[DependViz] ${this.getLibraryName()} is undefined!`);
      return null;
    }

    try {
      this.setupRenderer(container, ctx);
      const graph = this.createGraph(container, ctx);

      graph
        .backgroundColor(ctx.getBackgroundColor())
        .linkDirectionalArrowLength(5)
        .linkDirectionalArrowRelPos(1)
        .onNodeClick(node => {
          if (!node) return;
          this.callbacks.onNodeClick?.(node);
        });

      this.setupEventListeners(graph, ctx);

      return graph;
    } catch (error) {
      console.error(`[DependViz] Error initializing ${this.getModeName()} graph:`, error);
      return null;
    }
  }

  /**
   * ラベルレンダラーを作成（サブクラスで実装必須）
   * @param {Object} ctx - レンダリングコンテキスト
   * @returns {Object} ラベルレンダラー
   * @abstract
   */
  createLabelRenderer() {
    throw new Error('createLabelRenderer() must be implemented by subclass');
  }

  /**
   * グラフインスタンスを作成（サブクラスで実装必須）
   * @param {HTMLElement} container - グラフを表示するコンテナ要素
   * @param {Object} ctx - レンダリングコンテキスト
   * @returns {Object} グラフインスタンス
   * @abstract
   */
  createGraph() {
    throw new Error('createGraph() must be implemented by subclass');
  }

  /**
   * ノードにフォーカス（サブクラスで実装必須）
   * @param {Object} ctx - レンダリングコンテキスト
   * @param {Object} node - フォーカス対象のノード
   * @abstract
   */
  focusNode() {
    throw new Error('focusNode() must be implemented by subclass');
  }

  /**
   * ライブラリが利用可能かチェック（サブクラスで実装必須）
   * @returns {boolean} ライブラリが利用可能な場合true
   * @abstract
   */
  checkLibraryAvailability() {
    throw new Error('checkLibraryAvailability() must be implemented by subclass');
  }

  /**
   * ライブラリ名を取得（サブクラスで実装必須）
   * @returns {string} ライブラリ名
   * @abstract
   */
  getLibraryName() {
    throw new Error('getLibraryName() must be implemented by subclass');
  }

  /**
   * モード名を取得（サブクラスで実装必須）
   * @returns {string} モード名
   * @abstract
   */
  getModeName() {
    throw new Error('getModeName() must be implemented by subclass');
  }

  /**
   * レンダラーのセットアップ（サブクラスでオーバーライド可能）
   * @param {HTMLElement} container - グラフを表示するコンテナ要素
   * @param {Object} ctx - レンダリングコンテキスト
   */
  setupRenderer() {}

  /**
   * イベントリスナーのセットアップ（サブクラスでオーバーライド可能）
   * @param {Object} graph - グラフインスタンス
   * @param {Object} ctx - レンダリングコンテキスト
   */
  setupEventListeners() {}

  /**
   * グラフ更新時のコールバック（サブクラスでオーバーライド可能）
   * @param {Object} ctx - レンダリングコンテキスト
   */
  onGraphUpdated() {}

  /**
   * ノードとリンクをフィルタリング
   * @param {Array} nodes - ノード配列
   * @param {Array} links - リンク配列
   * @param {Object} state - 状態（controls を含む）
   * @returns {Object} フィルタリング済み { nodes, links }
   * @private
   */
  _applyFilter(nodes, links, state) {
    const controls = state.controls;
    const typeFilters = controls.typeFilters || {};

    const filteredNodes = nodes.filter(node => {
      const nodeTypeMap = typeFilters.node;
      if (nodeTypeMap && node.type && nodeTypeMap[node.type] !== undefined && !nodeTypeMap[node.type]) {
        return false;
      }
      if (controls.hideIsolatedNodes && (!node.neighbors || node.neighbors.length === 0)) return false;
      if (controls.search && !this._matchesSearchQuery(node, controls.search)) return false;
      return true;
    });

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = links.filter(link => {
      const edgeTypeMap = typeFilters.edge;
      if (edgeTypeMap && link.type && edgeTypeMap[link.type] !== undefined && !edgeTypeMap[link.type]) {
        return false;
      }
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }

  /**
   * ノードが検索クエリにマッチするか判定
   * @param {Object} node - ノード
   * @param {string} query - 検索クエリ
   * @returns {boolean} マッチする場合true
   * @private
   */
  _matchesSearchQuery(node, query) {
    if (!query) return true;
    const q = query.toLowerCase();

    if (q.includes(':')) {
      const hasAnd = q.includes(' and ');
      const hasOr = q.includes(' or ');
      const parts = q.split(/\s+and\s+|\s+or\s+/).map(s => s.trim());

      const results = parts.map(raw => {
        let subQ = raw;
        const isNot = subQ.startsWith('not ');
        if (isNot) subQ = subQ.substring(4);

        const match = subQ.match(/^(\w+):(.+)$/);
        if (!match) return isNot ? true : false;

        const [, field, rawValue] = match;
        const isRegex = rawValue.startsWith('/') && rawValue.endsWith('/');
        const searchValue = isRegex ? rawValue.slice(1, -1) : rawValue;

        let nodeValue = '';
        if (field === 'name') nodeValue = node.name || '';
        else if (field === 'type') nodeValue = node.type || '';
        else if (field === 'path') nodeValue = node.filePath || '';

        let ok = false;
        if (isRegex) {
          try {
            ok = new RegExp(searchValue, 'i').test(nodeValue);
          } catch (e) {
            ok = false;
          }
        } else {
          ok = nodeValue.toLowerCase().includes(searchValue.toLowerCase());
        }

        return isNot ? !ok : ok;
      });

      if (hasAnd && !hasOr) return results.every(Boolean);
      if (hasOr && !hasAnd) return results.some(Boolean);
      if (hasAnd && hasOr) return results.every(Boolean);
      return results[0];
    }

    return (node.name && node.name.toLowerCase().includes(q)) ||
           (node.id && node.id.toLowerCase().includes(q));
  }
}

/**
 * 色コードに透明度を適用
 * @param {string} color - 色コード（hex、rgb、rgbaなど）
 * @param {number} opacity - 透明度（0-1）
 * @returns {string} 透明度が適用された色コード
 */
function applyOpacityToColor(color, opacity) {
  if (opacity === undefined || opacity === 1) return color;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
  }

  return color;
}

export { applyOpacityToColor };
export default GraphView;
