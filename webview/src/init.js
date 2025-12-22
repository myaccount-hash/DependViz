import state from './GraphViewModel';

function initializeApp() {
  window.addEventListener('resize', state.handleResize.bind(state));

  state.initializeBridge();

  setTimeout(() => {
    if (state.initializeGraph()) {
      state.updateGraph();
    } else {
      console.error('[DependViz] Failed to initialize graph on startup');
    }
  }, 100);
}

initializeApp();
