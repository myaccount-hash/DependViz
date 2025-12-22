/**
 * 拡張機能とWebView間の通信を管理するクラス
 */
class ExtensionBridge {
  constructor(state) {
    this.state = state;
    this.vscode = null;
    this.handlers = {
      'graph:update': params => this.state.handleGraphUpdate(params || {}),
      'view:update': params => this.state.handleViewUpdate(params || {}),
      'node:focus': params => this.state.focusNodeById(params || {}),
      'mode:toggle': () => this._handleToggleMode(),
      'focus:clear': () => this.state.clearFocus()
    };
  }

  // VSCode APIを初期化
  initialize() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscode = acquireVsCodeApi();
    }
    if (!this.vscode) return null;
    
    window.addEventListener('message', event => {
      this.handle(event.data);
    });
    
    this.send('ready');
    return this.vscode;
  }

  // メッセージを処理
  handle(message) {
    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      return;
    }
    const handler = this.handlers[message.method];
    if (handler) {
      handler(message.params);
    } else if (message.method) {
      console.warn('[DependViz] Unknown message method:', message.method);
    }
  }

  // メッセージを送信
  send(method, params) {
    if (!this.vscode) return;
    const message = { jsonrpc: '2.0', method };
    if (params !== undefined) {
      message.params = params;
    }
    this.vscode.postMessage(message);
  }

  getVsCodeApi() {
    return this.vscode;
  }

  // モード切り替えを処理
  _handleToggleMode() {
    const newMode = !this.state.controls.is3DMode;
    this.state.updateControls({ is3DMode: newMode });
    this.state.clearRenderer();
    this.state.updateGraph({ reheatSimulation: true });
  }
}

export default ExtensionBridge;
