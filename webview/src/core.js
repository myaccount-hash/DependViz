let vscode = null;
if (typeof acquireVsCodeApi === 'function') {
    vscode = acquireVsCodeApi();
}

if (vscode) {
  window.addEventListener('message', event => {
    const msg = event.data;
    extensionBridge.handle(msg);
  });

  vscode.postMessage({ type: 'ready' });
}
