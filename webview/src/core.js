let vscodeApi = null;

export function initializeVsCode(extensionBridge) {
  if (typeof acquireVsCodeApi === 'function') {
    vscodeApi = acquireVsCodeApi();
  }

  if (vscodeApi) {
    window.addEventListener('message', event => {
      const msg = event.data;
      extensionBridge.handle(msg);
    });

    vscodeApi.postMessage({ type: 'ready' });
  }

  return vscodeApi;
}

export function getVsCodeApi() {
  return vscodeApi;
}
