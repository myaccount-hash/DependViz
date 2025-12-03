const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

class GraphState {
  constructor() {
    this.data = { nodes: [], links: [] };
    this.controls = DEFAULT_CONTROLS;
    this.ui = {
      highlightLinks: new Set(),
      stackTraceLinks: new Set(),
      focusedNode: null
    };
    this._graph = null;
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

  setGraph(graph) { this._graph = graph; }

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
    return { ...props, width: (props.widthMultiplier || 1) * this.controls.linkWidth };
  }

  initGraph() {
    const container = document.getElementById('graph-container');

    if (!container) {
      console.error('[DependViz] Container not found!');
      return false;
    }

    if (typeof ForceGraph === 'undefined') {
      console.error('[DependViz] ForceGraph is undefined!');
      return false;
    }

    try {
      const g = ForceGraph()(container)
        .backgroundColor(this.getBackgroundColor())
        .linkDirectionalArrowLength(5)
        .linkDirectionalArrowRelPos(1)
        .onNodeClick(node => {
          if (!node || !vscode) return;
          const filePath = state._getNodeFilePath(node);
          if (filePath) {
            vscode.postMessage({
              type: 'focusNode',
              node: {
                id: node.id,
                filePath: filePath,
                name: node.name
              }
            });
          }
        });
      this.setGraph(g);
      return true;
    } catch (error) {
      console.error('[DependViz] Error initializing graph:', error);
      return false;
    }
  }
}

const state = new GraphState();

function updateGraph() {
  if (!state.graph) {
    if (!state.initGraph()) {
      console.error('[DependViz] Failed to initialize graph');
      return;
    }
  }

  state.graph.backgroundColor(state.getBackgroundColor());

  const nodes = state.data.nodes || [];
  const links = state.data.links || [];

  const nodeVisualCache = new Map();
  nodes.forEach(node => { node.neighbors = []; node.links = []; nodeVisualCache.set(node, state.getNodeVisualProps(node)); });
  const linkVisualCache = new Map();
  links.forEach(link => {
    linkVisualCache.set(link, state.getLinkVisualProps(link));
    const a = nodes.find(n => n.id === link.source || n === link.source);
    const b = nodes.find(n => n.id === link.target || n === link.target);
    if (!a || !b) return;

    a.neighbors.push(b);
    b.neighbors.push(a);
    a.links.push(link);
    b.links.push(link);
  });

  const getNodeProps = node => nodeVisualCache.get(node);
  const getLinkProps = link => linkVisualCache.get(link);

  const filteredData = applyFilter(nodes, links);

  state.graph.graphData(filteredData);

  if (state.controls.showNames) {
    state.graph
      .nodeCanvasObject((node, ctx, globalScale) => {
        const props = getNodeProps(node);
        if (!props) return;
        const label = props.label || node.name || node.id;
        const fontSize = state.controls.nameFontSize / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = props.color || COLORS.NODE_DEFAULT;
        ctx.fillText(label, node.x, node.y);
      })
      .nodeCanvasObjectMode(() => 'after');
  } else {
    state.graph.nodeCanvasObjectMode(() => null);
  }

  state.graph
    .nodeLabel(node => {
      const props = getNodeProps(node);
      return props ? props.label : node.name || node.id;
    })
    .nodeColor(node => {
      const props = getNodeProps(node);
      return props ? props.color : COLORS.NODE_DEFAULT;
    })
    .nodeVal(node => {
      const props = getNodeProps(node);
      return props ? props.size : state.controls.nodeSize;
    })
    .linkColor(link => {
      const props = getLinkProps(link);
      return props ? props.color : COLORS.EDGE_DEFAULT;
    })
    .linkWidth(link => {
      const props = getLinkProps(link);
      return props ? props.width : state.controls.linkWidth;
    })
    .linkDirectionalArrowLength(state.controls.arrowSize)
    .linkDirectionalParticles(link => {
      const props = getLinkProps(link);
      return props ? (props.particles || 0) : 0;
    })
    .linkDirectionalParticleWidth(2);

  const linkForce = state.graph.d3Force('link');
  if (linkForce) linkForce.distance(state.controls.linkDistance);
  if (state.graph?.d3ReheatSimulation) setTimeout(() => state.graph.d3ReheatSimulation(), 100);
}

function applyFilter(nodes, links) {
  const controls = state.controls;

  let filteredNodes = nodes.filter(node => {
    if (!controls[`show${node.type}`]) return false;
    if (controls.hideIsolatedNodes && (!node.neighbors || node.neighbors.length === 0)) return false;
    if (controls.search && !matchesSearchQuery(node, controls.search)) return false;
    return true;
  });

  if (state.ui.focusedNode && (controls.enableForwardSlice || controls.enableBackwardSlice)) {
    const sliceNodes = new Set();
    sliceNodes.add(state.ui.focusedNode.id);

    if (controls.enableForwardSlice) {
      traverseSlice(state.ui.focusedNode, 'forward', controls.sliceDepth, sliceNodes, nodes, links);
    }
    if (controls.enableBackwardSlice) {
      traverseSlice(state.ui.focusedNode, 'backward', controls.sliceDepth, sliceNodes, nodes, links);
    }

    filteredNodes = filteredNodes.filter(node => sliceNodes.has(node.id));
  }

  const nodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => {
    if (!controls[`show${link.type}`]) return false;
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  return { nodes: filteredNodes, links: filteredLinks };
}

function traverseSlice(node, direction, depth, visited, allNodes, allLinks) {
  if (depth <= 0) return;

  const relevantLinks = allLinks.filter(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return direction === 'forward' ? sourceId === node.id : targetId === node.id;
  });

  relevantLinks.forEach(link => {
    const nextNodeId = direction === 'forward'
      ? (typeof link.target === 'object' ? link.target.id : link.target)
      : (typeof link.source === 'object' ? link.source.id : link.source);

    if (!visited.has(nextNodeId)) {
      visited.add(nextNodeId);
      const nextNode = allNodes.find(n => n.id === nextNodeId);
      if (nextNode) {
        traverseSlice(nextNode, direction, depth - 1, visited, allNodes, allLinks);
      }
    }
  });
}

function matchesSearchQuery(node, query) {
  if (!query) return true;
  const q = query.toLowerCase();

  // Simple field:value search
  if (q.includes(':')) {
    const queries = q.split(/\s+AND\s+|\s+OR\s+/).map(s => s.trim());
    const hasAnd = q.includes(' AND ');
    const hasOr = q.includes(' OR ');

    const results = queries.map(subQ => {
      if (subQ.startsWith('NOT ')) {
        return !evaluateFieldQuery(node, subQ.substring(4));
      }
      return evaluateFieldQuery(node, subQ);
    });

    if (hasAnd) return results.every(r => r);
    if (hasOr) return results.some(r => r);
    return results[0];
  }

  // Simple text search
  return (node.name && node.name.toLowerCase().includes(q)) ||
         (node.id && node.id.toLowerCase().includes(q));
}

function evaluateFieldQuery(node, query) {
  const match = query.match(/^(\w+):(.+)$/);
  if (!match) return false;

  const [, field, value] = match;
  const isRegex = value.startsWith('/') && value.endsWith('/');
  const searchValue = isRegex ? value.slice(1, -1) : value;

  let nodeValue = '';
  if (field === 'name') nodeValue = node.name || '';
  else if (field === 'type') nodeValue = node.type || '';
  else if (field === 'path') nodeValue = node.filePath || node.file || '';

  if (isRegex) {
    try {
      return new RegExp(searchValue, 'i').test(nodeValue);
    } catch (e) {
      return false;
    }
  }

  return nodeValue.toLowerCase().includes(searchValue.toLowerCase());
}

function handleResize() {
  if (!state.graph) return;
  const container = document.getElementById('graph-container');
  if (!container) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  state.graph.width(width).height(height);
}

function focusNodeByPath(filePath) {
  if (!filePath) return;
  const node = state.data.nodes.find(n => state._pathsMatch(state._getNodeFilePath(n), filePath));
  if (node) {
    state.ui.focusedNode = node;
    if (state.graph && node.x !== undefined && node.y !== undefined) {
      state.graph.centerAt(node.x, node.y, 1000);
      state.graph.zoom(3, 1000);
    }
    updateGraph();
  }
}

function focusNodeById(msg) {
  const nodeId = msg.nodeId || (msg.node && msg.node.id);
  const node = state.data.nodes.find(n => n.id === nodeId);

  if (!node) return;

  if (node.x === undefined || node.y === undefined) {
    setTimeout(() => focusNodeById(msg), 100);
    return;
  }

  state.ui.focusedNode = node;
  state.graph.centerAt(node.x, node.y, 1000);
  state.graph.zoom(3, 1000);
  updateGraph();
}

const messageHandlers = {
  data: msg => {
    state.updateData(msg.data);
    updateGraph();
  },
  controls: msg => {
    state.updateControls(msg.controls);
    updateGraph();
  },
  stackTrace: msg => {
    state.ui.stackTraceLinks = new Set(msg.paths.map(p => p.link));
    updateGraph();
  },
  focusNode: msg => {
    const filePath = msg.filePath || (msg.node && msg.node.filePath);
    if (filePath) {
      focusNodeByPath(filePath);
    }
  },
  focusNodeById: msg => {
    focusNodeById(msg);
  },
  update: msg => {
    if (msg.data) {
      state.updateData(msg.data);
    }
    if (msg.controls) {
      state.updateControls(msg.controls);
    }
    if (msg.stackTracePaths) {
      state.ui.stackTraceLinks = new Set(msg.stackTracePaths.map(p => p.link));
    }
    updateGraph();
  }
};

if (vscode) {
  window.addEventListener('message', event => {
    const msg = event.data;
    const handler = messageHandlers[msg.type];
    if (handler) {
      handler(msg);
    } else {
      console.warn('[DependViz] Unknown message type:', msg.type);
    }
  });

  vscode.postMessage({ type: 'ready' });
}

window.addEventListener('resize', handleResize);

// Initialize
setTimeout(() => {
  if (state.initGraph()) {
    updateGraph();
  } else {
    console.error('[DependViz] Failed to initialize graph on startup');
  }
}, 100);

