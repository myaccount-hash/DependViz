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
    this.state.handleGraphUpdate(msg?.payload || {});
  }

  _handleViewUpdate(msg) {
    this.state.handleViewUpdate(msg?.payload || {});
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
