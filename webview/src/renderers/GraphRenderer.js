// GraphRenderer.js
import { applyFilter } from '../utils';
/**
 * グラフのレンダリングと視覚属性計算を管理する基底クラス
 */
class GraphRenderer {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;

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

  // タイプに対応する色を取得
  _getTypeColor(ctx, category, type) {
    if (!type) return null;
    const map = ctx.controls.typeColors?.[category];
    if (!map) return null;
    const color = map[type];
    return typeof color === 'string' && color.length > 0 ? color : null;
  }

  // ルール配列を適用してプロパティを計算
  _applyRules(item, rules, defaults, ctx) {
    const result = { ...defaults };
    for (const rule of rules) {
      const ruleResult = rule(item, ctx);
      if (ruleResult) Object.assign(result, ruleResult);
    }
    return result;
  }

  // ノードの視覚属性を計算
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

  // リンクの視覚属性を計算
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

  // ラベルを適用
  _applyLabels(ctx, getNodeProps) {
    const labelRenderer = this.createLabelRenderer(ctx);
    if (ctx.controls.showNames) {
      labelRenderer.apply(ctx.graph, getNodeProps, ctx);
    } else {
      labelRenderer.clear(ctx.graph, ctx);
    }
  }

  // ノードとリンクの色を適用
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

  // グラフを更新
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

    const filteredData = applyFilter(nodes, links, ctx);
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

    const linkForce = ctx.graph.d3Force('link');
    if (linkForce) linkForce.distance(ctx.controls.linkDistance);

    if (reheatSimulation && ctx.graph?.d3ReheatSimulation) {
      setTimeout(() => ctx.graph.d3ReheatSimulation(), 100);
    }

    this.onGraphUpdated(ctx);
  }

  // 視覚属性のみを更新
  updateVisuals(ctx) {
    if (!ctx.graph) return;

    const getNodeProps = node => this.getNodeVisualProps(node, ctx);
    const getLinkProps = link => this.getLinkVisualProps(link, ctx);

    this._applyLabels(ctx, getNodeProps);
    this._applyColors(ctx, getNodeProps, getLinkProps);
  }

  // グラフを初期化
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

  // サブクラスで実装すべきメソッド
  createLabelRenderer() {
    throw new Error('createLabelRenderer() must be implemented by subclass');
  }

  createGraph() {
    throw new Error('createGraph() must be implemented by subclass');
  }

  focusNode() {
    throw new Error('focusNode() must be implemented by subclass');
  }

  checkLibraryAvailability() {
    throw new Error('checkLibraryAvailability() must be implemented by subclass');
  }

  getLibraryName() {
    throw new Error('getLibraryName() must be implemented by subclass');
  }

  getModeName() {
    throw new Error('getModeName() must be implemented by subclass');
  }

  setupRenderer() {}
  setupEventListeners() {}
  onGraphUpdated() {}
}

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
export default GraphRenderer;
