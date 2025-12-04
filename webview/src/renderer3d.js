// 3D専用レンダラー

function updateGraph3D(state, options = {}) {
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

  // 3Dモード専用: nodeThreeObject等を使用した高度なビジュアル化も可能
  // 現在はシンプルにnodeLabelを使用
  state.graph
    .nodeLabel(node => {
      const props = getNodeProps(node);
      if (state.controls.showNames) {
        return props ? props.label : node.name || node.id;
      }
      return '';
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

  // 3Dモードでもd3Forceが使用可能
  const linkForce = state.graph.d3Force('link');
  if (linkForce) linkForce.distance(state.controls.linkDistance);

  if (reheatSimulation && state.graph?.d3ReheatSimulation) {
    setTimeout(() => state.graph.d3ReheatSimulation(), 100);
  }
}

function updateVisuals3D(state) {
  if (!state.graph) return;

  const nodes = state.data.nodes || [];
  const links = state.data.links || [];

  const { nodeVisualCache, linkVisualCache } = buildVisualCache(nodes, links, state);
  const getNodeProps = node => nodeVisualCache.get(node);
  const getLinkProps = link => linkVisualCache.get(link);

  state.graph
    .nodeLabel(node => {
      const props = getNodeProps(node);
      if (state.controls.showNames) {
        return props ? props.label : node.name || node.id;
      }
      return '';
    })
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

function focusNode3D(state, node) {
  if (state.graph && node.x !== undefined && node.y !== undefined) {
    // 3Dモードの場合、centerAtには3つの座標が必要
    state.graph.centerAt(node.x, node.y, node.z || 0, 1000);
  }
}
