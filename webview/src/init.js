import ExtensionBridge from './ExtensionBridge';
import state from './state';
import { handleResize, updateGraph } from './runtime';
import { initializeVsCode } from './core';

export function initializeApplication() {
  window.addEventListener('resize', handleResize);

  const extensionBridge = new ExtensionBridge(state);
  initializeVsCode(extensionBridge);

  setTimeout(() => {
    if (state.initGraph()) {
      updateGraph();
    } else {
      console.error('[DependViz] Failed to initialize graph on startup');
    }
  }, 100);
}
