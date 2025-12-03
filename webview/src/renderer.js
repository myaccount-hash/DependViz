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
