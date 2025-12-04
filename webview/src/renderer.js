// メインレンダラー: 2D/3Dモードに応じて適切なレンダラーに委譲

const state = new GraphState();

// 共通ユーティリティ関数
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

function updateGraph(options = {}) {
  const { reheatSimulation = false } = options;

  if (!state.graph) {
    if (!state.initGraph()) {
      console.error('[DependViz] Failed to initialize graph');
      return;
    }
  }

  if (state.controls.is3DMode) {
    updateGraph3D(state, { reheatSimulation });
  } else {
    updateGraph2D(state, { reheatSimulation });
  }
}

function updateVisuals() {
  if (!state.graph) return;

  if (state.controls.is3DMode) {
    updateVisuals3D(state);
  } else {
    updateVisuals2D(state);
  }
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
    if (state.controls.is3DMode) {
      focusNode3D(state, node);
    } else {
      focusNode2D(state, node);
    }
    updateVisuals();
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
  if (state.controls.is3DMode) {
    focusNode3D(state, node);
  } else {
    focusNode2D(state, node);
  }
  updateVisuals();
}
