/**
 * Bridge for handling messages from VSCode Extension
 * Counterpart to WebviewBridge in src/utils/WebviewBridge.js
 */
class ExtensionBridge {
  static instance = null;

  static getInstance(state) {
    if (!ExtensionBridge.instance && state) {
      ExtensionBridge.instance = new ExtensionBridge(state);
    }
    return ExtensionBridge.instance;
  }

  constructor(state) {
    this.state = state;
    this.vscode = null;
    this.handlers = {
      'graph:update': msg => this._handleGraphUpdate(msg),
      'view:update': msg => this._handleViewUpdate(msg),
      'node:focus': msg => this._handleFocusNode(msg),
      'mode:toggle': () => this._handleToggleMode(),
      'focus:clear': () => this._handleClearFocus()
    };
  }

  initialize() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscode = acquireVsCodeApi();
    }
    if (!this.vscode) return null;
    window.addEventListener('message', event => {
      const msg = event.data;
      this.handle(msg);
    });
    this.send('ready');
    return this.vscode;
  }

  handle(message) {
    const handler = message && this.handlers[message.type];
    if (handler) {
      handler(message);
    } else if (message?.type) {
      console.warn('[DependViz] Unknown message type:', message.type);
    }
  }

  send(type, payload) {
    if (!this.vscode) return;
    const message = { type };
    if (payload && typeof payload === 'object') {
      Object.assign(message, payload);
    }
    this.vscode.postMessage(message);
  }

  getVsCodeApi() {
    return this.vscode;
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
