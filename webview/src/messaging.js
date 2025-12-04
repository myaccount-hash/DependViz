const messageHandlers = {
  data: msg => {
    state.updateData(msg.data);
    updateGraph({ reheatSimulation: true });
  },
  controls: msg => {
    state.updateControls(msg.controls);
    updateVisuals();
  },
  stackTrace: msg => {
    state.ui.stackTraceLinks = new Set(msg.paths.map(p => p.link));
    updateVisuals();
  },
  focusNode: msg => {
    const filePath = msg.filePath || (msg.node && msg.node.filePath);
    if (filePath) {
      focusNodeByPath(filePath);
    }
  },
  focusNodeById: msg => {
    focusNodeById(msg);
  },
  update: msg => {
    const hasDataChange = !!msg.data;
    const oldIs3DMode = state.controls.is3DMode;

    if (msg.data) {
      state.updateData(msg.data);
    }
    if (msg.controls) {
      state.updateControls(msg.controls);
    }
    if (msg.stackTracePaths) {
      state.ui.stackTraceLinks = new Set(msg.stackTracePaths.map(p => p.link));
    }

    // モードが変わった場合は完全に再初期化
    const modeChanged = msg.controls && (state.controls.is3DMode !== oldIs3DMode);

    if (hasDataChange || modeChanged) {
      updateGraph({ reheatSimulation: true });
    } else {
      updateVisuals();
    }
  },
  toggle3DMode: msg => {
    // controlsの更新が先に来るので、ここではグラフをリセットして再初期化するだけ
    state.toggleMode();
    // 次のcontrols更新メッセージでupdateGraphが呼ばれる
  }
};

if (vscode) {
  window.addEventListener('message', event => {
    const msg = event.data;
    const handler = messageHandlers[msg.type];
    if (handler) {
      handler(msg);
    } else {
      console.warn('[DependViz] Unknown message type:', msg.type);
    }
  });

  vscode.postMessage({ type: 'ready' });
}
