const { createMessage, isValidMessage } = require('./MessageTypes');

/**
 * Webviewとのメッセージングを管理するクラス
 * ExtensionBridgeと対応する
 * 通信は必ずこのクラスを介して行う
 *
 * 責務:
 * - Webviewへのメッセージ送信（JSONRPCプロトコル）
 * - Webviewからのメッセージ受信とコールバック呼び出し
 * - Webviewの準備完了までメッセージをキューイング
 */
class WebviewBridge {
    /**
     * WebviewBridgeを初期化
     * @param {Function} onMessage - メッセージ受信時のコールバック関数
     */
    constructor(onMessage) {
        this._webview = null;
        this._ready = false;
        this._queue = [];
        this._onMessage = onMessage;
    }

    /**
     * Webviewをアタッチし、メッセージリスナーを設定
     * @param {Object} webview - VSCode Webviewインスタンス
     */
    attach(webview) {
        this._webview = webview;
        this._ready = false;
        this._queue = [];

        if (webview?.onDidReceiveMessage) {
            webview.onDidReceiveMessage(message => {
                if (isValidMessage(message)) {
                    this._onMessage?.(message);
                }
            });
        }
    }

    /**
     * Webviewの準備完了をマークし、キューイングされたメッセージを送信
     */
    markReady() {
        this._ready = true;
        while (this._queue.length) {
            this._webview.postMessage(this._queue.shift());
        }
    }

    /**
     * Webviewにメッセージを送信
     * Webview未準備の場合はキューに追加
     * @param {string} method - メッセージタイプ
     * @param {*} params - パラメータ（省略可能）
     */
    send(method, params) {
        if (!this._webview) return;

        const message = createMessage(method, params);
        this._ready
            ? this._webview.postMessage(message)
            : this._queue.push(message);
    }
}

module.exports = WebviewBridge;
