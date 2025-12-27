import state from './GraphViewModel';

window.addEventListener('resize', state.handleResize.bind(state));

state.initializeBridge();

setTimeout(() => {
  if (!state.initializeGraph()) return;
  state.updateGraph();
}, 100);
