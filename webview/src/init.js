import ExtensionBridge from './ExtensionBridge';
import state from './GraphViewModel';

export function initializeApplication() {
  window.addEventListener('resize', () => state.handleResize());

  const extensionBridge = ExtensionBridge.getInstance(state);
  extensionBridge.initialize();

  setTimeout(() => {
    if (state.initGraph()) {
      state.updateGraph();
    } else {
      console.error('[DependViz] Failed to initialize graph on startup');
    }
  }, 100);
}

initializeApplication();
