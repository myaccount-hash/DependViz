// 2D専用レンダラー

function updateGraph2D(state, options = {}) {
  const { reheatSimulation = false } = options;

  if (!state.graph) {
    console.error('[DependViz] Graph not initialized');
    return;
  }

  state.graph.backgroundColor(state.getBackgroundColor());

  const nodes = state.data.nodes || [];
  const links = state.data.links || [];

  const { nodeVisualCache, linkVisualCache } = buildVisualCache(nodes, links, state);
  const getNodeProps = node => nodeVisualCache.get(node);
  const getLinkProps = link => linkVisualCache.get(link);

  const filteredData = applyFilter(nodes, links);
  state.graph.graphData(filteredData);

  // 2Dモード専用: nodeCanvasObjectを使用してテキストを描画
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

  // 共通設定
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

function updateVisuals2D(state) {
  if (!state.graph) return;

  const nodes = state.data.nodes || [];
  const links = state.data.links || [];

  const { nodeVisualCache, linkVisualCache } = buildVisualCache(nodes, links, state);
  const getNodeProps = node => nodeVisualCache.get(node);
  const getLinkProps = link => linkVisualCache.get(link);

  // 2Dモード専用: Canvas描画
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

function focusNode2D(state, node) {
  if (state.graph && node.x !== undefined && node.y !== undefined) {
    state.graph.centerAt(node.x, node.y, 1000);
  }
}
