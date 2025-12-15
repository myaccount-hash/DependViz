window.addEventListener('resize', handleResize);

setTimeout(() => {
  if (state.initGraph()) {
    updateGraph();
  } else {
    console.error('[DependViz] Failed to initialize graph on startup');
  }
}, 100);

const messageHandlers = createMessageHandlers(state);
