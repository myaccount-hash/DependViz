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
      toggle3DMode: () => this._handleToggle3DMode(),
      clearFocus: () => this._handleClearFocus()
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
    const incomingVersion = typeof msg.dataVersion === 'number' ? msg.dataVersion : null;
    const hasDataChange = msg.data && (
      incomingVersion === null || incomingVersion !== this.state.dataVersion
    );
    const oldIs3DMode = this.state.controls.is3DMode ?? false;

    if (msg.data) {
      if (hasDataChange) {
        this.state.updateData(msg.data, incomingVersion);
      }
    }
    if (msg.controls) {
      this.state.updateControls(msg.controls);
    }
    if (msg.stackTracePaths) {
      this.state.ui.stackTraceLinks = new Set(msg.stackTracePaths.map(p => p.link));
    }

    const newIs3DMode = this.state.controls.is3DMode ?? false;
    const modeChanged = msg.controls && (newIs3DMode !== oldIs3DMode);

    if (modeChanged) {
      this.state.toggleMode();
    }

    if (hasDataChange || modeChanged) {
      this.state.updateGraph({ reheatSimulation: true });
    } else {
      this.state.updateVisuals();
    }
  }

  _handleToggle3DMode() {
    this.state.toggleMode();
  }

  _handleClearFocus() {
    this.state.clearFocus();
  }
}

export default ExtensionBridge;
