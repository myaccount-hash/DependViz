import state from './GraphViewModel';

window.addEventListener('resize', state.handleResize.bind(state));

state.initializeBridge();

setTimeout(() => {
  if (state.getRenderer().initializeGraph()) {
    state.updateGraph();
  } else {
    console.error('[DependViz] Failed to initialize graph on startup');
  }
}, 100);
