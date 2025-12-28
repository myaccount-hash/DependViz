import { WEBVIEW_TO_EXTENSION, createMessage, isValidMessage } from './MessageTypes';

/**
 * 拡張機能とWebView間の通信を管理するクラス
 * VSCode APIを使用してメッセージを送受信
 *
 * メッセージ構造: { type: string, payload?: any }
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
      if (isValidMessage(event.data) && this.onMessage) {
        this.onMessage(event.data);
      }
    });

    this.send(WEBVIEW_TO_EXTENSION.READY);
    return this.vscode;
  }

  /**
   * VSCode拡張機能にメッセージを送信
   * @param {string} type - メッセージタイプ
   * @param {*} payload - ペイロード（省略可能）
   */
  send(type, payload) {
    if (!this.vscode) return;
    this.vscode.postMessage(createMessage(type, payload));
  }
}

export default ExtensionBridge;
