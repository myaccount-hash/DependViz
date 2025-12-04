// 3D専用レンダラー（mainブランチベース）

function updateGraph3D(state, options = {}) {
  const prepared = prepareGraphUpdate(state, options);
  if (!prepared) return;

  const { getNodeProps, getLinkProps, reheatSimulation: shouldReheat } = prepared;

  // 3Dモード: ラベル描画
  applyLabelRenderer(state, CSS3DLabelRenderer, getNodeProps);

  // 共通設定を適用
  applyCommonGraphSettings(state, getNodeProps, getLinkProps);

  // 3D専用: Z軸を平面に保つforce
  apply3DCustomForces(state);

  // シミュレーション再加熱
  reheatSimulation(state, shouldReheat);

  // 3D専用: 自動回転
  updateAutoRotation(state);
}

function updateVisuals3D(state) {
  const prepared = prepareVisualsUpdate(state);
  if (!prepared) return;

  const { getNodeProps, getLinkProps } = prepared;

  // 3Dモード: ラベル描画
  applyLabelRenderer(state, CSS3DLabelRenderer, getNodeProps);

  // 共通のビジュアル設定
  applyCommonVisualsSettings(state, getNodeProps, getLinkProps);
}

function focusNode3D(state, node) {
  if (!state.graph || !node) return;

  if (node.x === undefined || node.y === undefined || node.z === undefined) {
    setTimeout(() => focusNode3D(state, node), 100);
    return;
  }

  // 現在のカメラ位置を取得
  const currentCameraPos = state.graph.cameraPosition();
  const controls = state.graph.controls();

  // 現在の注目点（controls.target）を取得
  const currentTarget = controls ? {
    x: controls.target.x,
    y: controls.target.y,
    z: controls.target.z
  } : { x: 0, y: 0, z: 0 };

  // 現在のカメラと注目点との距離を計算
  const currentDistance = currentCameraPos
    ? Math.hypot(
        currentCameraPos.x - currentTarget.x,
        currentCameraPos.y - currentTarget.y,
        currentCameraPos.z - currentTarget.z
      )
    : state.controls.focusDistance;

  console.log('[focusNode3D] Current camera:', currentCameraPos);
  console.log('[focusNode3D] Current target:', currentTarget);
  console.log('[focusNode3D] Current distance:', currentDistance);
  console.log('[focusNode3D] New node:', { x: node.x, y: node.y, z: node.z });

  // 新しいノードに対して同じ距離を保持
  // ノードから距離currentDistanceだけ離れた位置にカメラを配置
  const direction = {
    x: currentCameraPos.x - currentTarget.x,
    y: currentCameraPos.y - currentTarget.y,
    z: currentCameraPos.z - currentTarget.z
  };
  const dirLength = Math.hypot(direction.x, direction.y, direction.z);

  const cameraPos = dirLength > 0
    ? {
      x: node.x + (direction.x / dirLength) * currentDistance,
      y: node.y + (direction.y / dirLength) * currentDistance,
      z: node.z + (direction.z / dirLength) * currentDistance
    }
    : {
      x: node.x + currentDistance,
      y: node.y,
      z: node.z
    };

  console.log('[focusNode3D] New camera position:', cameraPos);
  console.log('[focusNode3D] New distance will be:', Math.hypot(
    cameraPos.x - node.x,
    cameraPos.y - node.y,
    cameraPos.z - node.z
  ));

  state.graph.cameraPosition(cameraPos, node, DEBUG.AUTO_ROTATE_DELAY);
  setTimeout(() => updateAutoRotation(state), DEBUG.AUTO_ROTATE_DELAY);
}

function updateAutoRotation(state) {
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
        if (state.ui.focusedNode) {
          controls.target.set(
            state.ui.focusedNode.x || 0,
            state.ui.focusedNode.y || 0,
            state.ui.focusedNode.z || 0
          );
        }
        const elapsed = (Date.now() - state.rotation.startTime) * 0.001;
        const angle = state.rotation.startAngle + elapsed * state.controls.rotateSpeed;
        const distance = Math.hypot(pos.x, pos.z);
        const targetPos = {
          x: Math.sin(angle) * distance,
          y: pos.y,
          z: Math.cos(angle) * distance
        };
        state.graph.cameraPosition(targetPos, null, 0);
      }
      state.rotation.frame = requestAnimationFrame(rotate);
    };
    rotate();
  }
}

function initGraph3D(state) {
  const init = initGraphCommon(state, ForceGraph3D, 'ForceGraph3D');
  if (!init) return false;

  const { container } = init;

  try {
    // CSS2DRendererの初期化
    let renderer = null;
    if (typeof window.CSS2DRenderer !== 'undefined') {
      renderer = new window.CSS2DRenderer();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.pointerEvents = 'none';
      container.appendChild(renderer.domElement);
      state.setLabelRenderer(renderer);
    }

    const extraRenderers = renderer ? [renderer] : [];
    const g = ForceGraph3D({ extraRenderers })(container)
      .backgroundColor(state.getBackgroundColor())
      .linkDirectionalArrowLength(5)
      .linkDirectionalArrowRelPos(1)
      .onNodeClick(createNodeClickHandler(state));

    state.setGraph(g);

    // カメラコントロールイベント
    const controls = g.controls();
    if (controls) {
      controls.addEventListener('start', () => {
        state.ui.isUserInteracting = true;
        state.cancelRotation();
        updateAutoRotation(state);
      });
      controls.addEventListener('end', () => {
        state.cancelRotation();
        state.rotation.timeout = setTimeout(() => {
          state.ui.isUserInteracting = false;
          updateAutoRotation(state);
        }, DEBUG.AUTO_ROTATE_DELAY);
      });
    }

    return true;
  } catch (error) {
    console.error('[DependViz] Error initializing 3D graph:', error);
    return false;
  }
}

// 3D専用のカスタムforce適用
function apply3DCustomForces(state) {
  // 2D風のレイアウト: Z軸方向の力を弱める
  const chargeForce = state.graph.d3Force('charge');
  if (chargeForce) chargeForce.strength(-120);

  // Z軸を平面に保つ力を追加（カスタムforce）
  state.graph.d3Force('z', () => {
    let nodes;
    const strength = 0.1;
    const z = 0;

    function force(alpha) {
      if (!nodes) return;
      for (let i = 0, n = nodes.length; i < n; ++i) {
        const node = nodes[i];
        if (node.z !== undefined) {
          node.vz = node.vz || 0;
          node.vz += (z - node.z) * strength * alpha;
        }
      }
    }

    force.initialize = function(_) {
      nodes = _;
    };

    return force;
  });
}
