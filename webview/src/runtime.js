import state from './state';

export function updateGraph(options = {}) {
  state.updateGraph(options);
}

export function updateVisuals() {
  state.updateVisuals();
}

export function handleResize() {
  state.handleResize();
}

export function focusNodeByPath(filePath) {
  state.focusNodeByPath(filePath);
}

export function focusNodeById(msg) {
  state.focusNodeById(msg);
}
