const messageHandlers = {
  data: msg => {
    state.updateData(msg.data);
    updateGraph();
  },
  controls: msg => {
    state.updateControls(msg.controls);
    updateGraph();
  },
  stackTrace: msg => {
    state.ui.stackTraceLinks = new Set(msg.paths.map(p => p.link));
    updateGraph();
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
    if (msg.data) {
      state.updateData(msg.data);
    }
    if (msg.controls) {
      state.updateControls(msg.controls);
    }
    if (msg.stackTracePaths) {
      state.ui.stackTraceLinks = new Set(msg.stackTracePaths.map(p => p.link));
    }
    updateGraph();
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
