/**
 * 拡張機能とWebView間の通信を管理するシングルトンクラス
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
      'graph:update': msg => this.state.handleGraphUpdate(msg?.payload || {}),
      'view:update': msg => this.state.handleViewUpdate(msg?.payload || {}),
      'node:focus': msg => this.state.focusNodeById(msg?.payload || {}),
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
    const handler = message && this.handlers[message.type];
    if (handler) {
      handler(message);
    } else if (message?.type) {
      console.warn('[DependViz] Unknown message type:', message.type);
    }
  }

  // メッセージを送信
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

  // モード切り替えを処理
  _handleToggleMode() {
    const newMode = !this.state.controls.is3DMode;
    this.state.updateControls({ is3DMode: newMode });
    this.state.clearRenderer();
    this.state.updateGraph({ reheatSimulation: true });
  }
}

export default ExtensionBridge;