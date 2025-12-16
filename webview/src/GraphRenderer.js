import { applyFilter } from './utils';
import ExtensionBridge from './ExtensionBridge';

/**
 * グラフのレンダリングと更新を管理する基底クラス
 * GraphViewModelによって使用される．
 * TODO: ExtensionBridgeへの依存をなくす
 */

class GraphRenderer {
  constructor(state) {
    this.state = state;
  }

  // Build visual cache helper
  _buildVisualCacheForGraph() {
    const nodes = this.state.data.nodes || [];
    const links = this.state.data.links || [];
    const { nodeVisualCache, linkVisualCache } = buildVisualCache(nodes, links, this.state);
    return {
      nodes,
      links,
      getNodeProps: node => nodeVisualCache.get(node),
      getLinkProps: link => linkVisualCache.get(link)
    };
  }

  // Apply labels helper
  _applyLabels(getNodeProps) {
    const labelRenderer = this.createLabelRenderer();
    if (this.state.controls.showNames) {
      labelRenderer.apply(this.state.graph, getNodeProps);
    } else {
      labelRenderer.clear(this.state.graph);
    }
  }

  // Apply node and link colors helper
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

  // Common graph update logic
  updateGraph(options = {}) {
    const { reheatSimulation = false } = options;

    if (!this.state.graph) {
      console.error('[DependViz] Graph not initialized');
      return;
    }

    this.state.graph.backgroundColor(this.state.getBackgroundColor());

    const { nodes, links, getNodeProps, getLinkProps } = this._buildVisualCacheForGraph();

    const filteredData = applyFilter(nodes, links, this.state);
    this.state.graph.graphData(filteredData);

    this._applyLabels(getNodeProps);

    // Common graph properties
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

    // Subclass-specific post-update logic
    this.onGraphUpdated();
  }

  // Common visual update logic
  updateVisuals() {
    if (!this.state.graph) return;

    // Recompute slice highlight on visuals update (e.g., setting change)
    if (this.state.updateSliceHighlight) {
      this.state.updateSliceHighlight(this.state.data.nodes || [], this.state.data.links || []);
    }

    const { getNodeProps, getLinkProps } = this._buildVisualCacheForGraph();

    this._applyLabels(getNodeProps);
    this._applyColors(getNodeProps, getLinkProps);
  }

  // Common initialization logic
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

  // Methods to be implemented by subclasses
  createLabelRenderer() {
    throw new Error('createLabelRenderer() must be implemented by subclass');
  }

  createGraph(container) {
    throw new Error('createGraph() must be implemented by subclass');
  }

  focusNode(node) {
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

  // Optional hooks for subclasses
  setupRenderer(container) {
    // Override if needed
  }

  setupEventListeners(graph) {
    // Override if needed
  }

  onGraphUpdated() {
    // Override if needed
  }
}

function applyOpacityToColor(color, opacity) {
  if (opacity === undefined || opacity === 1) return color;

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Handle rgb/rgba
  if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
  }

  return color;
}

function buildVisualCache(nodes, links, state) {
  const nodeVisualCache = new Map();
  const nodeById = new Map();

  nodes.forEach(node => {
    node.neighbors = [];
    node.links = [];
    nodeVisualCache.set(node, state.getNodeVisualProps(node));
    if (node.id != null) {
      nodeById.set(node.id, node);
    }
  });

  const linkVisualCache = new Map();
  links.forEach(link => {
    linkVisualCache.set(link, state.getLinkVisualProps(link));

    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    const a = nodeById.get(sourceId);
    const b = nodeById.get(targetId);
    if (!a || !b) return;

    a.neighbors.push(b);
    b.neighbors.push(a);
    a.links.push(link);
    b.links.push(link);
  });

  return { nodeVisualCache, linkVisualCache };
}

export { applyOpacityToColor };
export default GraphRenderer;
