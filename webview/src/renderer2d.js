// 2D専用レンダラー

function updateGraph2D(state, options = {}) {
  const prepared = prepareGraphUpdate(state, options);
  if (!prepared) return;

  const { getNodeProps, getLinkProps, reheatSimulation: shouldReheat } = prepared;

  // 2Dモード専用: ラベル描画
  applyLabelRenderer(state, Canvas2DLabelRenderer, getNodeProps);

  // 共通設定を適用
  applyCommonGraphSettings(state, getNodeProps, getLinkProps);

  // シミュレーション再加熱
  reheatSimulation(state, shouldReheat);
}

function updateVisuals2D(state) {
  const prepared = prepareVisualsUpdate(state);
  if (!prepared) return;

  const { getNodeProps, getLinkProps } = prepared;

  // 2Dモード専用: ラベル描画
  applyLabelRenderer(state, Canvas2DLabelRenderer, getNodeProps);

  // 共通のビジュアル設定
  applyCommonVisualsSettings(state, getNodeProps, getLinkProps);
}

function focusNode2D(state, node) {
  if (state.graph && node.x !== undefined && node.y !== undefined) {
    state.graph.centerAt(node.x, node.y, 1000);
  }
}

function initGraph2D(state) {
  const init = initGraphCommon(state, ForceGraph, 'ForceGraph');
  if (!init) return false;

  const { container, GraphConstructor } = init;

  try {
    const g = GraphConstructor()(container)
      .backgroundColor(state.getBackgroundColor())
      .linkDirectionalArrowLength(5)
      .linkDirectionalArrowRelPos(1)
      .onNodeClick(createNodeClickHandler(state));

    state.setGraph(g);
    return true;
  } catch (error) {
    console.error('[DependViz] Error initializing 2D graph:', error);
    return false;
  }
}
