window.addEventListener('resize', handleResize);

setTimeout(() => {
  if (state.initGraph()) {
    updateGraph();
  } else {
    console.error('[DependViz] Failed to initialize graph on startup');
  }
}, 100);

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

    const modeChanged = msg.controls && (state.controls.is3DMode !== oldIs3DMode);

    if (hasDataChange || modeChanged) {
      updateGraph({ reheatSimulation: true });
    } else {
      updateVisuals();
    }
  },
  toggle3DMode: msg => {
       state.toggleMode();
  }
};
