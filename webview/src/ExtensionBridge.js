/**
 * Bridge for handling messages from VSCode Extension
 * Counterpart to WebviewBridge in src/utils/WebviewBridge.js
 */
class ExtensionBridge {
  constructor(state) {
    this.state = state;
    this.handlers = {
      stackTrace: msg => this._handleStackTrace(msg),
      focusNodeById: msg => this._handleFocusNodeById(msg),
      update: msg => this._handleUpdate(msg),
      toggle3DMode: () => this._handleToggle3DMode()
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

  _handleStackTrace(msg) {
    this.state.ui.stackTraceLinks = new Set(msg.paths.map(p => p.link));
    this.state.updateVisuals();
  }

  _handleFocusNodeById(msg) {
    this.state.focusNodeById(msg);
  }

  _handleUpdate(msg) {
    const hasDataChange = !!msg.data;
    const oldIs3DMode = this.state.controls.is3DMode;

    if (msg.data) {
      this.state.updateData(msg.data);
    }
    if (msg.controls) {
      this.state.updateControls(msg.controls);
    }
    if (msg.stackTracePaths) {
      this.state.ui.stackTraceLinks = new Set(msg.stackTracePaths.map(p => p.link));
    }

    const modeChanged = msg.controls && (this.state.controls.is3DMode !== oldIs3DMode);

    if (hasDataChange || modeChanged) {
      this.state.updateGraph({ reheatSimulation: true });
    } else {
      this.state.updateVisuals();
    }
  }

  _handleToggle3DMode() {
    this.state.toggleMode();
  }
}

export default ExtensionBridge;
