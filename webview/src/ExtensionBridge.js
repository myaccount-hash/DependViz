/**
 * 拡張機能とWebView間の通信を管理するクラス
 */
class ExtensionBridge {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.vscode = null;
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
    if (!this.onMessage) return;
    this.onMessage(message);
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

}

export default ExtensionBridge;
