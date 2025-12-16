/**
 * Bridge for handling messages from VSCode Extension
 * Counterpart to WebviewBridge in src/utils/WebviewBridge.js
 */
class ExtensionBridge {
  constructor(state) {
    this.state = state;
    this.handlers = {
      'graph:update': msg => this._handleGraphUpdate(msg),
      'view:update': msg => this._handleViewUpdate(msg),
      'node:focus': msg => this._handleFocusNode(msg),
      'mode:toggle': () => this._handleToggleMode(),
      'focus:clear': () => this._handleClearFocus()
    };
  }

  handle(message) {
    const handler = this.handlers[message.type];
    if (handler) {
      handler(message);
    } else {
      console.warn('[DependViz] Unknown message type:', message.type);
    }
  }

  _handleGraphUpdate(msg) {
    const payload = msg?.payload || {};
    const incomingVersion = typeof payload.dataVersion === 'number' ? payload.dataVersion : null;
    const hasDataChange = payload.data && (incomingVersion === null || incomingVersion !== this.state.dataVersion);
    const oldIs3DMode = this.state.controls.is3DMode ?? false;

    if (payload.data) {
      if (hasDataChange) {
        this.state.updateData(payload.data, incomingVersion);
      }
    }
    if (payload.controls) {
      this.state.updateControls(payload.controls);
    }
    if (payload.stackTracePaths) {
      this.state.ui.stackTraceLinks = new Set(payload.stackTracePaths.map(p => p.link));
    }

    const newIs3DMode = this.state.controls.is3DMode ?? false;
    const modeChanged = payload.controls && (newIs3DMode !== oldIs3DMode);

    if (modeChanged) this.state.toggleMode();

    const reheatSimulation = hasDataChange || modeChanged;
    this.state.updateGraph({ reheatSimulation });
  }

  _handleViewUpdate(msg) {
    const payload = msg?.payload || {};
    const oldIs3DMode = this.state.controls.is3DMode ?? false;

    if (payload.controls) {
      this.state.updateControls(payload.controls);
    }
    if (payload.stackTracePaths) {
      this.state.ui.stackTraceLinks = new Set(payload.stackTracePaths.map(p => p.link));
    }

    const newIs3DMode = this.state.controls.is3DMode ?? false;
    const modeChanged = payload.controls && (newIs3DMode !== oldIs3DMode);

    if (modeChanged) {
      this.state.toggleMode();
      this.state.updateGraph({ reheatSimulation: true });
      return;
    }

    if (payload.controls) {
      this.state.updateGraph();
      return;
    }

    this.state.updateVisuals();
  }

  _handleFocusNode(msg) {
    this.state.focusNodeById(msg?.payload || {});
  }

  _handleToggleMode() {
    this.state.toggleMode();
  }

  _handleClearFocus() {
    this.state.clearFocus();
  }
}

export default ExtensionBridge;
