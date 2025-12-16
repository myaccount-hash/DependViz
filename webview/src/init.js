import ExtensionBridge from './ExtensionBridge';
import state from './graphState';
import { initializeVsCode } from './core';

export function initializeApplication() {
  window.addEventListener('resize', () => state.handleResize());

  const extensionBridge = new ExtensionBridge(state);
  initializeVsCode(extensionBridge);

  setTimeout(() => {
    if (state.initGraph()) {
      state.updateGraph();
    } else {
      console.error('[DependViz] Failed to initialize graph on startup');
    }
  }, 100);
}

initializeApplication();
