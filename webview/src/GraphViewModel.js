import GraphRenderer2D from './GraphRenderer2D';
import GraphRenderer3D from './GraphRenderer3D';
import { computeSlice } from './utils';

/**
 * アプリケーションのグラフ状態を管理するクラス
 * Webviewプロセスの中心的な役割を果たす
 */
class GraphViewModel {
  constructor() {
    this.data = { nodes: [], links: [] };
    this.dataVersion = null;
    this.controls = {};
    this.ui = {
      stackTraceLinks: new Set(),
      sliceNodes: null,
      sliceLinks: null,
      focusedNode: null,
      isUserInteracting: false
    };
    this.rotation = {
      frame: null,
      startTime: null,
      startAngle: null,
      timeout: null
    };
    this._graph = null;
    this._labelRenderer = null;
    this._currentRenderer = null;
    this.nodeRules = [
      (node, ctx) => {
        const map = {
          Class: ctx.controls.colorClass,
          AbstractClass: ctx.controls.colorAbstractClass,
          Interface: ctx.controls.colorInterface,
          Unknown: ctx.controls.colorUnknown
        };
        return map[node.type] ? { color: map[node.type] } : null;
      },
      (node, ctx) => ctx.controls.nodeSizeByLoc && node.linesOfCode > 0 && {
        sizeMultiplier: Math.max(1, Math.pow(node.linesOfCode, 0.7))
      }
    ];
    this.linkRules = [
      (link, ctx) => {
        const COLORS = ctx.controls.COLORS || {};
        return ctx.ui.stackTraceLinks.has(link) && {
          color: COLORS.STACK_TRACE_LINK || '#51cf66',
          widthMultiplier: 2.5,
          particles: 5
        };
      },
      (link, ctx) => {
        const map = {
          ObjectCreate: ctx.controls.colorObjectCreate,
          Extends: ctx.controls.colorExtends,
          Implements: ctx.controls.colorImplements,
          TypeUse: ctx.controls.colorTypeUse,
          MethodCall: ctx.controls.colorMethodCall
        };
        return map[link.type] ? { color: map[link.type] } : null;
      }
    ];
  }

  get graph() { return this._graph; }
  get labelRenderer() { return this._labelRenderer; }

  setGraph(graph) { this._graph = graph; }
  setLabelRenderer(renderer) { this._labelRenderer = renderer; }

  getBackgroundColor() {
    const style = getComputedStyle(document.body);
    const bgColor = style.getPropertyValue('--vscode-editor-background').trim();
    const COLORS = this.controls.COLORS || {};
    return bgColor || COLORS.BACKGROUND_DARK || '#1a1a1a';
  }

  updateData(data, version) {
    this.data = { nodes: [...(data.nodes || [])], links: [...(data.links || [])] };
    if (typeof version === 'number') {
      this.dataVersion = version;
    } else {
      this.dataVersion = (this.dataVersion ?? 0) + 1;
    }
  }

  updateControls(controls) {
    this.controls = { ...this.controls, ...controls };
  }

  getNodeFilePath(node) {
    return node.filePath || node.file;
  }

  _normalizePath(path) {
    if (!path) return '';
    let normalized = path.replace(/\\/g, '/');
    normalized = normalized.replace(/\/+$/, '');
    const parts = normalized.split('/').filter(p => p && p !== '.');
    const result = [];
    for (const part of parts) {
      if (part === '..') {
        if (result.length > 0 && result[result.length - 1] !== '..') {
          result.pop();
        } else {
          result.push(part);
        }
      } else {
        result.push(part);
      }
    }
    return result.join('/');
  }

  _pathsMatch(path1, path2) {
    if (!path1 || !path2) return false;
    const norm1 = this._normalizePath(path1);
    const norm2 = this._normalizePath(path2);
    if (norm1 === norm2) return true;
    const parts1 = norm1.split('/').filter(Boolean);
    const parts2 = norm2.split('/').filter(Boolean);
    if (parts1.length === 0 || parts2.length === 0) return false;
    const minLen = Math.min(parts1.length, parts2.length);
    if (minLen < 2) return false;
    for (let i = 1; i <= minLen; i++) {
      const suffix1 = parts1.slice(-i).join('/');
      const suffix2 = parts2.slice(-i).join('/');
      if (suffix1 === suffix2) return true;
    }
    return false;
  }

  _computeNodeLabel(node) {
    if (!node.name) return node.id || '';
    if (!this.controls.shortNames) return node.name;
    const lastDot = node.name.lastIndexOf('.');
    return lastDot !== -1 ? node.name.substring(lastDot + 1) : node.name;
  }

  _applyRules(item, rules, defaults) {
    const result = { ...defaults };
    for (const rule of rules) {
      const ruleResult = rule(item, this);
      if (ruleResult) Object.assign(result, ruleResult);
    }
    return result;
  }

  getNodeVisualProps(node) {
    const COLORS = this.controls.COLORS || {};
    const props = this._applyRules(node, this.nodeRules, {
      color: COLORS.NODE_DEFAULT || '#93c5fd',
      sizeMultiplier: 1,
      label: this._computeNodeLabel(node),
      opacity: this.controls.nodeOpacity
    });

    const hasSlice = this.ui.sliceNodes && this.ui.sliceNodes.size > 0;

    // Apply slice-aware dimming
    if (hasSlice) {
      if (!this.ui.sliceNodes.has(node.id)) {
        props.opacity = (props.opacity || 1) * 0.1;
      }
    } else if (this.ui.focusedNode && (this.controls.enableForwardSlice || this.controls.enableBackwardSlice)) {
      const isFocused = node.id === this.ui.focusedNode.id;
      const isNeighbor = this.ui.focusedNode.neighbors &&
                         this.ui.focusedNode.neighbors.some(n => n.id === node.id);

      if (!isFocused && !isNeighbor) {
        const dim = this.controls.dimOpacity ?? 0.2;
        props.opacity = (props.opacity || 1) * dim;
      }
    }

    return { ...props, size: (props.sizeMultiplier || 1) * this.controls.nodeSize };
  }

  getLinkVisualProps(link) {
    const COLORS = this.controls.COLORS || {};
    const props = this._applyRules(link, this.linkRules, {
      color: COLORS.EDGE_DEFAULT || '#4b5563',
      widthMultiplier: 1,
      particles: 0,
      opacity: this.controls.edgeOpacity,
      arrowSize: this.controls.arrowSize
    });

    // Apply focus dimming and highlighting
    const hasSlice = this.ui.sliceNodes && this.ui.sliceNodes.size > 0;

    if (hasSlice) {
      const inSlice = this.ui.sliceLinks ? this.ui.sliceLinks.has(link) : false;
      if (inSlice) {
        props.particles = Math.max(props.particles || 0, 2);
        props.widthMultiplier = (props.widthMultiplier || 1) * 1.5;
      } else {
        props.opacity = (props.opacity || 1) * 0.1;
      }
    } else if (this.ui.focusedNode && (this.controls.enableForwardSlice || this.controls.enableBackwardSlice)) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const focusedId = this.ui.focusedNode.id;

      const isConnectedToFocus = sourceId === focusedId || targetId === focusedId;

      if (isConnectedToFocus) {
        // Add particles to focused edges
        props.particles = 3;
        props.widthMultiplier = (props.widthMultiplier || 1) * 1.5;
      } else {
        const dim = this.controls.dimOpacity ?? 0.2;
        props.opacity = (props.opacity || 1) * dim;
      }
    }

    return { ...props, width: (props.widthMultiplier || 1) * this.controls.linkWidth };
  }

  initGraph() {
    const renderer = this.controls.is3DMode
      ? new GraphRenderer3D(this)
      : new GraphRenderer2D(this);
    return renderer.initGraph();
  }

  updateSliceHighlight(nodes, links) {
    if (!this.ui.focusedNode || (!this.controls.enableForwardSlice && !this.controls.enableBackwardSlice)) {
      this.ui.sliceNodes = null;
      this.ui.sliceLinks = null;
      return;
    }
    const { sliceNodes, sliceLinks } = computeSlice(this.ui.focusedNode, this.controls, nodes, links);
    this.ui.sliceNodes = sliceNodes;
    this.ui.sliceLinks = sliceLinks;
  }

  toggleMode() {
    // 設定値は外部（GraphViewProvider）で更新されるので、ここではグラフをリセットするだけ
    if (this.rotation.frame) {
      cancelAnimationFrame(this.rotation.frame);
      this.rotation.frame = null;
    }
    clearTimeout(this.rotation.timeout);
    this._graph = null;
    this._labelRenderer = null;
    this._currentRenderer = null;
  }

  getRenderer() {
    if (!this._currentRenderer || this._currentRenderer.state.controls.is3DMode !== this.controls.is3DMode) {
      this._currentRenderer = this.controls.is3DMode
        ? new GraphRenderer3D(this)
        : new GraphRenderer2D(this);
    }
    return this._currentRenderer;
  }

  updateGraph(options = {}) {
    const { reheatSimulation = false } = options;

    if (!this._graph) {
      if (!this.initGraph()) {
        console.error('[DependViz] Failed to initialize graph');
        return;
      }
    }

    this.getRenderer().updateGraph({ reheatSimulation });
  }

  updateVisuals() {
    if (!this._graph) return;
    this.getRenderer().updateVisuals();
  }

  handleGraphUpdate(payload = {}) {
    const incomingVersion = typeof payload.dataVersion === 'number' ? payload.dataVersion : null;
    const hasDataChange = payload.data && (incomingVersion === null || incomingVersion !== this.dataVersion);
    const oldIs3DMode = this.controls.is3DMode ?? false;

    if (payload.data && hasDataChange) {
      this.updateData(payload.data, incomingVersion);
    }
    if (payload.controls) {
      this.updateControls(payload.controls);
    }
    if (payload.stackTracePaths) {
      this.ui.stackTraceLinks = new Set(payload.stackTracePaths.map(p => p.link));
    }

    if (payload.data || payload.controls) {
      this.updateSliceHighlight(this.data.nodes, this.data.links);
    }

    const newIs3DMode = this.controls.is3DMode ?? false;
    const modeChanged = payload.controls && (newIs3DMode !== oldIs3DMode);
    if (modeChanged) this.toggleMode();

    const reheatSimulation = hasDataChange || modeChanged;
    if (payload.data || payload.controls) {
      this.updateGraph({ reheatSimulation });
    } else if (payload.stackTracePaths) {
      this.updateVisuals();
    }
  }

  handleViewUpdate(payload = {}) {
    const oldIs3DMode = this.controls.is3DMode ?? false;

    if (payload.controls) {
      this.updateControls(payload.controls);
    }
    if (payload.stackTracePaths) {
      this.ui.stackTraceLinks = new Set(payload.stackTracePaths.map(p => p.link));
    }

    if (payload.controls) {
      this.updateSliceHighlight(this.data.nodes, this.data.links);
    }

    const newIs3DMode = this.controls.is3DMode ?? false;
    const modeChanged = payload.controls && (newIs3DMode !== oldIs3DMode);

    if (modeChanged) {
      this.toggleMode();
      this.updateGraph({ reheatSimulation: true });
    } else if (payload.controls) {
      this.updateGraph();
    } else if (payload.stackTracePaths) {
      this.updateVisuals();
    }
  }

  handleResize() {
    if (!this._graph) return;
    const container = document.getElementById('graph-container');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this._graph.width(width).height(height);
  }

  focusNodeByPath(filePath) {
    if (!filePath) return;
    const node = this.data.nodes.find(n => this._pathsMatch(this.getNodeFilePath(n), filePath));
    if (node) {
      this.ui.focusedNode = node;
      this.getRenderer().focusNode(node);
      this.updateSliceHighlight(this.data.nodes, this.data.links);
      this.updateVisuals();
    }
  }

  focusNodeById(msg) {
    const nodeId = msg.nodeId || (msg.node && msg.node.id);
    const node = this.data.nodes.find(n => n.id === nodeId);

    if (!node) return;

    if (node.x === undefined || node.y === undefined) {
      setTimeout(() => this.focusNodeById(msg), 100);
      return;
    }

    this.ui.focusedNode = node;
    this.getRenderer().focusNode(node);
    this.updateSliceHighlight(this.data.nodes, this.data.links);
    this.updateVisuals();
  }

  clearFocus() {
    this.ui.focusedNode = null;
    const renderer = this.getRenderer();
    if (renderer?.cancelRotation) renderer.cancelRotation();
    if (renderer?.updateAutoRotation) renderer.updateAutoRotation();
    this.updateSliceHighlight(this.data.nodes, this.data.links);
    this.updateVisuals();
  }
}

const state = new GraphViewModel();

export { GraphViewModel, state };
export default state;
