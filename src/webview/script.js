const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

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
    return bgColor || (this.controls.darkMode ? COLORS.BACKGROUND_DARK : COLORS.BACKGROUND_LIGHT);
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
    // Normalize path separators (Windows \ to Unix /)
    let normalized = path.replace(/\\/g, '/');
    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');
    // Normalize .. and . (simple implementation)
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

  _matchPath(nodePath, framePath) {
    if (!nodePath || !framePath) return 0;

    const normalizedNodePath = this._normalizePath(nodePath);
    const normalizedFramePath = this._normalizePath(framePath);

    // Extract basenames
    const nodeBasename = normalizedNodePath.split('/').pop();
    const frameBasename = normalizedFramePath.split('/').pop();

    // Skip empty basenames (from trailing slashes)
    if (!nodeBasename || !frameBasename) return 0;

    // Exact match - highest priority
    if (normalizedNodePath === normalizedFramePath) return 1000;

    // endsWith match - prioritize longer matches
    if (normalizedFramePath.endsWith(normalizedNodePath)) {
      return 500 + normalizedNodePath.length;
    }
    if (normalizedNodePath.endsWith(normalizedFramePath)) {
      return 500 + normalizedFramePath.length;
    }

    // Basename match - lowest priority (only if unique enough)
    if (nodeBasename === frameBasename && nodeBasename.length > 0) {
      return 100;
    }

    return 0;
  }

  setStackTraceLinks(paths) {
    console.log('[StackTrace] Received paths:', paths.length, paths);

    const baseLinks = this.data.links.filter(l => !l.isStackTraceLink);
    const stackNodes = [];
    const unmatchedPaths = [];

    paths.forEach((p, idx) => {
      const path = p;

      // 空文字列やnullをスキップ
      if (!path || !path.trim()) {
        console.warn(`[StackTrace] [${idx}] Skipping empty/whitespace path`);
        return;
      }

      // Find best matching node
      let bestNode = null;
      let bestScore = 0;

      for (const n of this.data.nodes) {
        const nodePath = this._getNodeFilePath(n);
        const score = this._matchPath(nodePath, path);
        if (score > bestScore) {
          bestScore = score;
          bestNode = n;
        }
      }

      if (bestNode && bestScore > 0) {
        stackNodes.push(bestNode);
        console.log(`[StackTrace] [${idx}] Matched: ${path} -> ${bestNode.id} (score: ${bestScore})`);
      } else {
        unmatchedPaths.push(path);
        console.warn(`[StackTrace] [${idx}] NOT matched: ${path}`);
      }
    });

    if (unmatchedPaths.length > 0) {
      console.warn(`[StackTrace] ${unmatchedPaths.length} paths not matched. Sample available nodes:`,
        this.data.nodes.slice(0, 5).map(n => ({ id: n.id, path: this._getNodeFilePath(n) }))
      );
    }

    const newLinks = [];
    for (let i = 0; i < stackNodes.length - 1; i++) {
      newLinks.push({
        source: stackNodes[i + 1].id,
        target: stackNodes[i].id,
        type: 'StackTrace',
        isStackTraceLink: true
      });
    }

    console.log(`[StackTrace] Created ${newLinks.length} stack trace links from ${stackNodes.length} matched nodes`);

    this.data.links = [...baseLinks, ...newLinks];
    this.ui.stackTraceLinks = new Set(newLinks);
  }

  clearHighlights() {
    this.ui.highlightLinks.clear();
  }

  // ノード表示プロパティの統合計算
  getNodeVisualProps(node) {
    const props = this._applyRules(node, this.nodeRules, {
      color: COLORS.NODE_DEFAULT,
      sizeMultiplier: 1,
      label: this._computeNodeLabel(node),
      opacity: this.controls.nodeOpacity
    });
    return { ...props, size: (props.sizeMultiplier || 1) * this.controls.nodeSize };
  }

  _computeNodeLabel(node) {
    const name = node.name;
    if (!this.controls.shortNames || !name) return name;
    return name.split('.').pop();
  }

  // リンク表示プロパティの統合計算
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

  _applyRules(target, rules, base) {
    const ctx = { controls: this.controls, ui: this.ui };
    return rules.reduce((acc, rule) => {
      const result = rule(target, ctx);
      return result ? { ...acc, ...result } : acc;
    }, { ...base });
  }

  cancelRotation() {
    if (this.rotation.frame) {
      cancelAnimationFrame(this.rotation.frame);
      this.rotation.frame = null;
    }
    clearTimeout(this.rotation.timeout);
  }

  initGraph() {
    const container = document.getElementById('graph-container');
    if (!container || typeof ForceGraph3D === 'undefined') return false;

    const renderer = new window.CSS2DRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);
    this.setLabelRenderer(renderer);

    const g = ForceGraph3D({ extraRenderers: [renderer] })(container)
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

    const controls = g.controls();
    if (controls) {
      controls.addEventListener('start', () => {
        this.ui.isUserInteracting = true;
        this.cancelRotation();
        updateAutoRotation();
      });
      controls.addEventListener('end', () => {
        this.cancelRotation();
        this.rotation.timeout = setTimeout(() => {
          this.ui.isUserInteracting = false;
          updateAutoRotation();
        }, DEBUG.AUTO_ROTATE_DELAY);
      });
    }
    return true;
  }
}

const state = new GraphState();

function updateGraph() {
  if (!state.graph && !state.initGraph()) return;

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

  state.graph.graphData({ nodes, links });

  const getNodeProps = node => nodeVisualCache.get(node) || state.getNodeVisualProps(node);
  const getLinkProps = link => linkVisualCache.get(link) || state.getLinkVisualProps(link);

  // 統合された表示プロパティを使用
  state.graph
    .nodeLabel(node => getNodeProps(node).label)
    .nodeColor(node => getNodeProps(node).color)
    .nodeVal(node => getNodeProps(node).size)
    .nodeOpacity(state.controls.nodeOpacity)
    .linkColor(link => getLinkProps(link).color)
    .linkWidth(link => getLinkProps(link).width)
    .linkOpacity(state.controls.edgeOpacity)
    .linkDirectionalArrowLength(state.controls.arrowSize)
    .linkDirectionalParticles(link => getLinkProps(link).particles)
    .linkDirectionalParticleWidth(2);

  if (state.controls.showNames) {
    state.graph.nodeThreeObject(node => {
      const props = getNodeProps(node);
      const div = document.createElement('div');
      div.textContent = props.label;
      Object.assign(div.style, {
        fontSize: `${state.controls.nameFontSize}px`,
        fontFamily: 'sans-serif',
        padding: '2px 4px',
        borderRadius: '2px',
        pointerEvents: 'none',
        color: props.color
      });
      const label = new window.CSS2DObject(div);
      label.position.set(0, -8, 0);
      return label;
    }).nodeThreeObjectExtend(true);
  } else {
    state.graph.nodeThreeObject(null).nodeThreeObjectExtend(false);
  }

  const linkForce = state.graph.d3Force('link');
  if (linkForce) linkForce.distance(state.controls.linkDistance);
  if (state.graph?.d3ReheatSimulation) setTimeout(() => state.graph.d3ReheatSimulation(), 100);

  updateAutoRotation();
}

function updateAutoRotation() {
  state.cancelRotation();
  if (!state.graph) return;

  if (state.controls.autoRotate && !state.ui.isUserInteracting) {
    const pos = state.graph.cameraPosition();
    state.rotation.startAngle = Math.atan2(pos.x, pos.z);
    state.rotation.startTime = Date.now();

    const rotate = () => {
      const camera = state.graph.camera();
      const controls = state.graph.controls();
      if (camera && controls) {
        if (state.ui.focusedNode) controls.target.set(state.ui.focusedNode.x || 0, state.ui.focusedNode.y || 0, state.ui.focusedNode.z || 0);
        const elapsed = (Date.now() - state.rotation.startTime) * 0.001;
        const angle = state.rotation.startAngle + elapsed * state.controls.rotateSpeed;
        const distance = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
        camera.position.x = distance * Math.sin(angle);
        camera.position.z = distance * Math.cos(angle);
        camera.lookAt(controls.target);
      }
      state.rotation.frame = requestAnimationFrame(rotate);
    };
    rotate();
  } else if (state.ui.focusedNode) {
    const keepFocus = () => {
      const controls = state.graph.controls();
      if (controls && state.ui.focusedNode) controls.target.set(state.ui.focusedNode.x || 0, state.ui.focusedNode.y || 0, state.ui.focusedNode.z || 0);
      state.rotation.frame = requestAnimationFrame(keepFocus);
    };
    keepFocus();
  }
}

function handleResize() {
  if (!state.graph || !state.labelRenderer) return;
  const container = document.getElementById('graph-container');
  if (!container) return;

  const width = container.clientWidth;
  const height = container.clientHeight;

  state.graph.width(width).height(height);
  state.labelRenderer.setSize(width, height);

  const camera = state.graph.camera();
  if (camera) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

window.addEventListener('resize', handleResize);

const messageHandlers = {
  update: (msg) => {
    state.updateControls(msg.controls);
    if (msg.data) state.updateData(msg.data);
    if (msg.stackTracePaths && Array.isArray(msg.stackTracePaths)) {
      state.setStackTraceLinks(msg.stackTracePaths);
    }
    updateGraph();
  },

  focusNodeById: (msg) => {
    if (!state.graph || !state.data.nodes || !state.data.nodes.length) return;
    const node = state.data.nodes.find(n => n.id === msg.nodeId);
    if (!node) return;

    if (node.links && state.ui.stackTraceLinks.size === 0) {
      state.clearHighlights();
      node.links.forEach(l => state.ui.highlightLinks.add(l));
    }

    state.ui.focusedNode = node;
    state.graph.linkWidth(state.graph.linkWidth()).linkDirectionalParticles(state.graph.linkDirectionalParticles());

    if (node.x === undefined || node.y === undefined || node.z === undefined) {
      setTimeout(() => messageHandlers.focusNodeById(msg), 100);
      return;
    }

    const nodeDistance = Math.hypot(node.x, node.y, node.z);
    const focusDistance = state.controls.focusDistance;
    const cameraPos = nodeDistance > 0
      ? {
        x: node.x * (1 + focusDistance / nodeDistance),
        y: node.y * (1 + focusDistance / nodeDistance),
        z: node.z * (1 + focusDistance / nodeDistance)
      }
      : { x: focusDistance, y: 0, z: 0 };

    state.graph.cameraPosition(cameraPos, node, DEBUG.AUTO_ROTATE_DELAY);
    setTimeout(() => updateAutoRotation(), DEBUG.AUTO_ROTATE_DELAY);
  }
};

window.addEventListener('message', event => {
  const { type, ...data } = event.data;
  messageHandlers[type]?.({ ...data, type });
});

function waitForLibraries() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (typeof ForceGraph3D !== 'undefined' && window.CSS2DRenderer) {
        clearInterval(check);
        resolve(true);
      }
    }, 100);
    setTimeout(() => { clearInterval(check); resolve(false); }, 10000);
  });
}

async function init() {
  await waitForLibraries();
  state.initGraph();

  // Webview準備完了を通知
  if (vscode) {
    vscode.postMessage({ type: 'ready' });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
