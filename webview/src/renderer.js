const state = new GraphState();

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

function updateGraph(options = {}) {
  const { reheatSimulation = false } = options;

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
        const fontSize = state.controls.textSize || 12;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = applyOpacityToColor('#ffffff', props.opacity);
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
      const color = props ? props.color : COLORS.NODE_DEFAULT;
      return applyOpacityToColor(color, props?.opacity);
    })
    .nodeVal(node => {
      const props = getNodeProps(node);
      return props ? props.size : state.controls.nodeSize;
    })
    .linkColor(link => {
      const props = getLinkProps(link);
      const color = props ? props.color : COLORS.EDGE_DEFAULT;
      return applyOpacityToColor(color, props?.opacity);
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

  if (reheatSimulation && state.graph?.d3ReheatSimulation) {
    setTimeout(() => state.graph.d3ReheatSimulation(), 100);
  }
}

function updateVisuals() {
  if (!state.graph) return;

  const nodes = state.data.nodes || [];
  const links = state.data.links || [];

  const nodeVisualCache = new Map();
  nodes.forEach(node => {
    nodeVisualCache.set(node, state.getNodeVisualProps(node));
  });

  const linkVisualCache = new Map();
  links.forEach(link => {
    linkVisualCache.set(link, state.getLinkVisualProps(link));
  });

  const getNodeProps = node => nodeVisualCache.get(node);
  const getLinkProps = link => linkVisualCache.get(link);

  if (state.controls.showNames) {
    state.graph
      .nodeCanvasObject((node, ctx, globalScale) => {
        const props = getNodeProps(node);
        if (!props) return;
        const label = props.label || node.name || node.id;
        const fontSize = state.controls.textSize || 12;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = applyOpacityToColor('#ffffff', props.opacity);
        ctx.fillText(label, node.x, node.y);
      })
      .nodeCanvasObjectMode(() => 'after');
  } else {
    state.graph.nodeCanvasObjectMode(() => null);
  }

  state.graph
    .nodeColor(node => {
      const props = getNodeProps(node);
      const color = props ? props.color : COLORS.NODE_DEFAULT;
      return applyOpacityToColor(color, props?.opacity);
    })
    .linkColor(link => {
      const props = getLinkProps(link);
      const color = props ? props.color : COLORS.EDGE_DEFAULT;
      return applyOpacityToColor(color, props?.opacity);
    })
    .linkDirectionalParticles(link => {
      const props = getLinkProps(link);
      return props ? (props.particles || 0) : 0;
    });
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
  state.graph.centerAt(node.x, node.y, 1000);
  updateVisuals();
}
