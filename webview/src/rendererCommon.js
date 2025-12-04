// レンダラー共通関数

/**
 * グラフ更新の共通準備処理
 */
function prepareGraphUpdate(state, options = {}) {
  const { reheatSimulation = false } = options;

  if (!state.graph) {
    console.error('[DependViz] Graph not initialized');
    return null;
  }

  state.graph.backgroundColor(state.getBackgroundColor());

  const nodes = state.data.nodes || [];
  const links = state.data.links || [];

  const { nodeVisualCache, linkVisualCache } = buildVisualCache(nodes, links, state);
  const getNodeProps = node => nodeVisualCache.get(node);
  const getLinkProps = link => linkVisualCache.get(link);

  const filteredData = applyFilter(nodes, links);
  state.graph.graphData(filteredData);

  return {
    nodes,
    links,
    getNodeProps,
    getLinkProps,
    reheatSimulation
  };
}

/**
 * 共通のグラフ設定を適用
 */
function applyCommonGraphSettings(state, getNodeProps, getLinkProps) {
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
}

/**
 * ラベルレンダラーを適用
 */
function applyLabelRenderer(state, labelRendererClass, getNodeProps) {
  const labelRenderer = new labelRendererClass(state);
  if (state.controls.showNames) {
    labelRenderer.apply(state.graph, getNodeProps);
  } else {
    labelRenderer.clear(state.graph);
  }
}

/**
 * シミュレーションの再加熱
 */
function reheatSimulation(state, shouldReheat) {
  if (shouldReheat && state.graph?.d3ReheatSimulation) {
    setTimeout(() => state.graph.d3ReheatSimulation(), 100);
  }
}

/**
 * ビジュアル更新の共通準備処理
 */
function prepareVisualsUpdate(state) {
  if (!state.graph) return null;

  const nodes = state.data.nodes || [];
  const links = state.data.links || [];

  const { nodeVisualCache, linkVisualCache } = buildVisualCache(nodes, links, state);
  const getNodeProps = node => nodeVisualCache.get(node);
  const getLinkProps = link => linkVisualCache.get(link);

  return {
    nodes,
    links,
    getNodeProps,
    getLinkProps
  };
}

/**
 * 共通のビジュアル設定を適用
 */
function applyCommonVisualsSettings(state, getNodeProps, getLinkProps) {
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

/**
 * グラフ初期化の共通処理
 */
function initGraphCommon(state, GraphConstructor, constructorName) {
  const container = document.getElementById('graph-container');
  if (!container) {
    console.error('[DependViz] Container not found!');
    return false;
  }

  if (typeof GraphConstructor === 'undefined') {
    console.error(`[DependViz] ${constructorName} is undefined!`);
    return false;
  }

  return { container, GraphConstructor };
}

/**
 * 共通のノードクリックハンドラー
 */
function createNodeClickHandler(state) {
  return (node) => {
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
  };
}
