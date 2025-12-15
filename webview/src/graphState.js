class GraphState {
  constructor() {
    this.data = { nodes: [], links: [] };
    this.controls = DEFAULT_CONTROLS;
    this.ui = {
      highlightLinks: new Set(),
      stackTraceLinks: new Set(),
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
      (link, ctx) => ctx.ui.stackTraceLinks.has(link) && {
        color: COLORS.STACK_TRACE_LINK,
        widthMultiplier: 2.5,
        particles: 5
      },
      (link, ctx) => ctx.ui.highlightLinks.has(link) && {
        widthMultiplier: 2,
        particles: 4
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
    return bgColor || COLORS.BACKGROUND_DARK;
  }

  updateData(data) {
    this.data = { nodes: [...(data.nodes || [])], links: [...(data.links || [])] };
  }

  updateControls(controls) {
    this.controls = { ...this.controls, ...controls };
  }

  _getNodeFilePath(node) {
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
    const props = this._applyRules(node, this.nodeRules, {
      color: COLORS.NODE_DEFAULT,
      sizeMultiplier: 1,
      label: this._computeNodeLabel(node),
      opacity: this.controls.nodeOpacity
    });

    // Apply focus dimming
    if (this.ui.focusedNode) {
      const isFocused = node.id === this.ui.focusedNode.id;
      const isNeighbor = this.ui.focusedNode.neighbors &&
                         this.ui.focusedNode.neighbors.some(n => n.id === node.id);

      if (!isFocused && !isNeighbor) {
        props.opacity = (props.opacity || 1) * 0.2;
      }
    }

    return { ...props, size: (props.sizeMultiplier || 1) * this.controls.nodeSize };
  }

  getLinkVisualProps(link) {
    const props = this._applyRules(link, this.linkRules, {
      color: COLORS.EDGE_DEFAULT,
      widthMultiplier: 1,
      particles: 0,
      opacity: this.controls.edgeOpacity,
      arrowSize: this.controls.arrowSize
    });

    // Apply focus dimming and highlighting
    if (this.ui.focusedNode) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const focusedId = this.ui.focusedNode.id;

      const isConnectedToFocus = sourceId === focusedId || targetId === focusedId;

      if (isConnectedToFocus) {
        // Add particles to focused edges
        props.particles = 3;
        props.widthMultiplier = (props.widthMultiplier || 1) * 1.5;
      } else {
        props.opacity = (props.opacity || 1) * 0.1;
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

  toggleMode() {
    // 設定値は外部（GraphViewProvider）で更新されるので、ここではグラフをリセットするだけ
    if (this.rotation.frame) {
      cancelAnimationFrame(this.rotation.frame);
      this.rotation.frame = null;
    }
    clearTimeout(this.rotation.timeout);
    this._graph = null;
    this._labelRenderer = null;
  }
}
