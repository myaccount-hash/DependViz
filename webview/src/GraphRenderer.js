// GraphRenderer.js
import { applyFilter } from './utils';
import ExtensionBridge from './ExtensionBridge';

/**
 * グラフのレンダリングと視覚属性計算を管理する基底クラス
 * TODO: ExtensionBridgeの依存を解消
 */
class GraphRenderer {
  constructor(state) {
    this.state = state;
    this.is3DMode = state.controls.is3DMode ?? false;
    
    this.nodeRules = [
      (node, ctx) => {
        const color = ctx._getTypeColor('node', node.type);
        return color ? { color } : null;
      },
      (node, ctx) => ctx.state.controls.nodeSizeByLoc && node.linesOfCode > 0 && {
        sizeMultiplier: Math.max(1, Math.pow(node.linesOfCode, 0.7))
      }
    ];
    
    this.linkRules = [
      (link, ctx) => {
        const hasPath = ctx.state.ui.highlightedPath;
        if (!hasPath || !hasPath.pathLinks) return null;
        
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        const isPathLink = hasPath.pathLinks.some(pl => 
          (pl.source === sourceId && pl.target === targetId) ||
          (pl.source === targetId && pl.target === sourceId)
        );
        
        if (isPathLink) {
          const COLORS = ctx.state.controls.COLORS || {};
          return {
            color: COLORS.PATH_LINK || '#fbbf24',
            widthMultiplier: 2.5,
            particles: 5
          };
        }
        return null;
      },
      (link, ctx) => {
        const COLORS = ctx.state.controls.COLORS || {};
        return ctx.state.ui.callStackLinks.has(link) && {
          color: COLORS.STACK_TRACE_LINK || '#51cf66',
          widthMultiplier: 2.5,
          particles: 5
        };
      },
      (link, ctx) => {
        const color = ctx._getTypeColor('edge', link.type);
        return color ? { color } : null;
      }
    ];
  }

  // ノードの表示ラベルを計算
  _computeNodeLabel(node) {
    if (!node.name) return node.id || '';
    if (!this.state.controls.shortNames) return node.name;
    const lastDot = node.name.lastIndexOf('.');
    return lastDot !== -1 ? node.name.substring(lastDot + 1) : node.name;
  }

  // タイプに対応する色を取得
  _getTypeColor(category, type) {
    if (!type) return null;
    const map = this.state.controls.typeColors?.[category];
    if (!map) return null;
    const color = map[type];
    return typeof color === 'string' && color.length > 0 ? color : null;
  }

  // ルール配列を適用してプロパティを計算
  _applyRules(item, rules, defaults) {
    const result = { ...defaults };
    for (const rule of rules) {
      const ruleResult = rule(item, this);
      if (ruleResult) Object.assign(result, ruleResult);
    }
    return result;
  }

  // ノードの視覚属性を計算
  getNodeVisualProps(node) {
    const COLORS = this.state.controls.COLORS || {};
    const props = this._applyRules(node, this.nodeRules, {
      color: COLORS.NODE_DEFAULT || '#93c5fd',
      sizeMultiplier: 1,
      label: this._computeNodeLabel(node),
      opacity: this.state.controls.nodeOpacity
    });

    const hasPath = this.state.ui.highlightedPath;
    const hasSlice = this.state.ui.sliceNodes && this.state.ui.sliceNodes.size > 0;

    if (hasPath) {
      if (hasPath.nodes.has(node.id)) {
        props.sizeMultiplier = (props.sizeMultiplier || 1) * 1.3;
      } else {
        props.opacity = (props.opacity || 1) * 0.15;
      }
      return { 
        ...props, 
        size: (props.sizeMultiplier || 1) * this.state.controls.nodeSize 
      };
    }

    if (hasSlice) {
      if (!this.state.ui.sliceNodes.has(node.id)) {
        props.opacity = (props.opacity || 1) * 0.1;
      }
    } else if (this.state.ui.focusedNode && 
               (this.state.controls.enableForwardSlice || this.state.controls.enableBackwardSlice)) {
      const isFocused = node.id === this.state.ui.focusedNode.id;
      const isNeighbor = this.state.ui.focusedNode.neighbors &&
                         this.state.ui.focusedNode.neighbors.some(n => n.id === node.id);

      if (!isFocused && !isNeighbor) {
        const dim = this.state.controls.dimOpacity ?? 0.2;
        props.opacity = (props.opacity || 1) * dim;
      }
    }

    return { 
      ...props, 
      size: (props.sizeMultiplier || 1) * this.state.controls.nodeSize 
    };
  }

  // リンクの視覚属性を計算
  getLinkVisualProps(link) {
    const COLORS = this.state.controls.COLORS || {};
    const props = this._applyRules(link, this.linkRules, {
      color: COLORS.EDGE_DEFAULT || '#4b5563',
      widthMultiplier: 1,
      particles: 0,
      opacity: this.state.controls.edgeOpacity,
      arrowSize: this.state.controls.arrowSize
    });

    const hasPath = this.state.ui.highlightedPath;
    const hasSlice = this.state.ui.sliceNodes && this.state.ui.sliceNodes.size > 0;

    if (hasPath) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      const isPathLink = hasPath.pathLinks.some(pl => 
        (pl.source === sourceId && pl.target === targetId) ||
        (pl.source === targetId && pl.target === sourceId)
      );
      
      if (!isPathLink) {
        props.opacity = (props.opacity || 1) * 0.15;
      }
      return { 
        ...props, 
        width: (props.widthMultiplier || 1) * this.state.controls.linkWidth 
      };
    }

    if (hasSlice) {
      const inSlice = this.state.ui.sliceLinks ? this.state.ui.sliceLinks.has(link) : false;
      if (inSlice) {
        props.particles = Math.max(props.particles || 0, 2);
        props.widthMultiplier = (props.widthMultiplier || 1) * 1.5;
      } else {
        props.opacity = (props.opacity || 1) * 0.1;
      }
    } else if (this.state.ui.focusedNode && 
               (this.state.controls.enableForwardSlice || this.state.controls.enableBackwardSlice)) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const focusedId = this.state.ui.focusedNode.id;

      const isConnectedToFocus = sourceId === focusedId || targetId === focusedId;

      if (isConnectedToFocus) {
        props.particles = 3;
        props.widthMultiplier = (props.widthMultiplier || 1) * 1.5;
      } else {
        const dim = this.state.controls.dimOpacity ?? 0.2;
        props.opacity = (props.opacity || 1) * dim;
      }
    }

    return { 
      ...props, 
      width: (props.widthMultiplier || 1) * this.state.controls.linkWidth 
    };
  }

  // ラベルを適用
  _applyLabels(getNodeProps) {
    const labelRenderer = this.createLabelRenderer();
    if (this.state.controls.showNames) {
      labelRenderer.apply(this.state.graph, getNodeProps);
    } else {
      labelRenderer.clear(this.state.graph);
    }
  }

  // ノードとリンクの色を適用
  _applyColors(getNodeProps, getLinkProps) {
    const COLORS = this.state.controls.COLORS || {};
    this.state.graph
      .nodeColor(node => {
        const props = getNodeProps(node);
        const color = props ? props.color : (COLORS.NODE_DEFAULT || '#93c5fd');
        return applyOpacityToColor(color, props?.opacity);
      })
      .linkColor(link => {
        const props = getLinkProps(link);
        const color = props ? props.color : (COLORS.EDGE_DEFAULT || '#4b5563');
        return applyOpacityToColor(color, props?.opacity);
      })
      .linkDirectionalParticles(link => {
        const props = getLinkProps(link);
        return props ? (props.particles || 0) : 0;
      });
  }

  // グラフを更新
  updateGraph(options = {}) {
    const { reheatSimulation = false } = options;

    if (!this.state.graph) {
      console.error('[DependViz] Graph not initialized');
      return;
    }

    this.state.graph.backgroundColor(this.state.getBackgroundColor());

    const nodes = this.state.data.nodes || [];
    const links = this.state.data.links || [];
    const getNodeProps = node => this.getNodeVisualProps(node);
    const getLinkProps = link => this.getLinkVisualProps(link);

    const filteredData = applyFilter(nodes, links, this.state);
    this.state.graph.graphData(filteredData);

    this._applyLabels(getNodeProps);

    this.state.graph
      .nodeLabel(node => {
        const props = getNodeProps(node);
        return props ? props.label : node.name || node.id;
      })
      .nodeVal(node => {
        const props = getNodeProps(node);
        return props ? props.size : this.state.controls.nodeSize;
      })
      .linkWidth(link => {
        const props = getLinkProps(link);
        return props ? props.width : this.state.controls.linkWidth;
      })
      .linkDirectionalArrowLength(this.state.controls.arrowSize)
      .linkDirectionalParticleWidth(2);

    this._applyColors(getNodeProps, getLinkProps);

    const linkForce = this.state.graph.d3Force('link');
    if (linkForce) linkForce.distance(this.state.controls.linkDistance);

    if (reheatSimulation && this.state.graph?.d3ReheatSimulation) {
      setTimeout(() => this.state.graph.d3ReheatSimulation(), 100);
    }

    this.onGraphUpdated();
  }

  // 視覚属性のみを更新
  updateVisuals() {
    if (!this.state.graph) return;

    const getNodeProps = node => this.getNodeVisualProps(node);
    const getLinkProps = link => this.getLinkVisualProps(link);

    this._applyLabels(getNodeProps);
    this._applyColors(getNodeProps, getLinkProps);
  }

  // グラフを初期化
  initGraph() {
    const container = document.getElementById('graph-container');
    if (!container) {
      console.error('[DependViz] Container not found!');
      return false;
    }

    if (!this.checkLibraryAvailability()) {
      console.error(`[DependViz] ${this.getLibraryName()} is undefined!`);
      return false;
    }

    try {
      this.setupRenderer(container);
      const graph = this.createGraph(container);

      graph
        .backgroundColor(this.state.getBackgroundColor())
        .linkDirectionalArrowLength(5)
        .linkDirectionalArrowRelPos(1)
        .onNodeClick(node => {
          if (!node) return;
          const filePath = this.state.getNodeFilePath(node);
          if (filePath) {
            ExtensionBridge.getInstance()?.send('focusNode', {
              node: {
                id: node.id,
                filePath: filePath,
                name: node.name
              }
            });
          }
        });

      this.state.setGraph(graph);
      this.setupEventListeners(graph);

      return true;
    } catch (error) {
      console.error(`[DependViz] Error initializing ${this.getModeName()} graph:`, error);
      return false;
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
