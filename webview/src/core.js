let vscode = null;
if (typeof acquireVsCodeApi === 'function') {
    vscode = acquireVsCodeApi();
}

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
