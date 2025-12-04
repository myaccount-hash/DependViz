// 3D専用レンダラー（mainブランチベース）

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

  // 3Dモード: nodeThreeObjectでCSS2DObjectを使用
  const labelRenderer = new CSS3DLabelRenderer(state);
  if (state.controls.showNames) {
    labelRenderer.apply(state.graph, getNodeProps);
  } else {
    labelRenderer.clear(state.graph);
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

  if (reheatSimulation && state.graph?.d3ReheatSimulation) {
    setTimeout(() => state.graph.d3ReheatSimulation(), 100);
  }

  updateAutoRotation(state);
}

function updateVisuals3D(state) {
  if (!state.graph) return;

  const nodes = state.data.nodes || [];
  const links = state.data.links || [];

  const { nodeVisualCache, linkVisualCache } = buildVisualCache(nodes, links, state);
  const getNodeProps = node => nodeVisualCache.get(node);
  const getLinkProps = link => linkVisualCache.get(link);

  // nodeThreeObjectの更新
  const labelRenderer = new CSS3DLabelRenderer(state);
  if (state.controls.showNames) {
    labelRenderer.apply(state.graph, getNodeProps);
  } else {
    labelRenderer.clear(state.graph);
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

function focusNode3D(state, node) {
  if (!state.graph || !node) return;

  if (node.x === undefined || node.y === undefined || node.z === undefined) {
    setTimeout(() => focusNode3D(state, node), 100);
    return;
  }

  // 現在のカメラ位置を取得
  const currentCameraPos = state.graph.cameraPosition();

  // 現在のカメラと注目点との距離を計算
  const currentDistance = currentCameraPos
    ? Math.hypot(
        currentCameraPos.x - (state.ui.focusedNode?.x || 0),
        currentCameraPos.y - (state.ui.focusedNode?.y || 0),
        currentCameraPos.z - (state.ui.focusedNode?.z || 0)
      )
    : state.controls.focusDistance;

  // その距離を保持して新しいノードにフォーカス
  const nodeDistance = Math.hypot(node.x, node.y, node.z);
  const cameraPos = nodeDistance > 0
    ? {
      x: node.x * (1 + currentDistance / nodeDistance),
      y: node.y * (1 + currentDistance / nodeDistance),
      z: node.z * (1 + currentDistance / nodeDistance)
    }
    : { x: currentDistance, y: 0, z: 0 };

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
      if (controls && state.ui.focusedNode) {
        controls.target.set(
          state.ui.focusedNode.x || 0,
          state.ui.focusedNode.y || 0,
          state.ui.focusedNode.z || 0
        );
      }
      state.rotation.frame = requestAnimationFrame(keepFocus);
    };
    keepFocus();
  }
}

function initGraph3D(state) {
  const container = document.getElementById('graph-container');
  if (!container) {
    console.error('[DependViz] Container not found!');
    return false;
  }

  if (typeof ForceGraph3D === 'undefined') {
    console.error('[DependViz] ForceGraph3D is undefined!');
    return false;
  }

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
