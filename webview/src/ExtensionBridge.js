/**
 * 拡張機能とWebView間の通信を管理するクラス
 * VSCode APIを使用してJSONRPCメッセージを送受信
 */
class ExtensionBridge {
  /**
   * ExtensionBridgeを初期化
   * @param {Function} onMessage - メッセージ受信時のコールバック関数
   */
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.vscode = null;
  }

  /**
   * VSCode APIを初期化
   * acquireVsCodeApi()でVSCode APIを取得し、メッセージリスナーを設定
   * 初期化完了後、'ready'メッセージを送信
   * @returns {Object|null} VSCode APIインスタンス、または取得失敗時null
   */
  initializeBridge() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscode = acquireVsCodeApi();
    }
    if (!this.vscode) return null;
    
    window.addEventListener('message', event => {
      if (this.onMessage) {
        this.onMessage(event.data);
      }
    });
    
    this.send('ready');
    return this.vscode;
  }

  /**
   * VSCode拡張機能にJSONRPCメッセージを送信
   * @param {string} method - メソッド名
   * @param {*} params - パラメータ（省略可能）
   */
  send(method, params) {
    if (!this.vscode) return;
    const message = { jsonrpc: '2.0', method };
    if (params !== undefined) {
      message.params = params;
    }
    this.vscode.postMessage(message);
  }
}

export default ExtensionBridge;
