import state from './GraphViewModel';

export function initializeApplication() {
  window.addEventListener('resize', () => state.handleResize());

  state.initializeBridge();

  setTimeout(() => {
    if (state.initGraph()) {
      state.updateGraph();
    } else {
      console.error('[DependViz] Failed to initialize graph on startup');
    }
  }, 100);
}

initializeApplication();
