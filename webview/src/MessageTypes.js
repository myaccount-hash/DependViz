/**
 * Extension ⇔ Webview 間の通信メッセージタイプ定義
 *
 * メッセージ構造: { type: string, payload?: any }
 *
 * Note: このファイルはsrc/bridge/MessageTypes.jsと同期を保つ必要があります
 */

/**
 * Extension → Webview メッセージタイプ
 */
export const EXTENSION_TO_WEBVIEW = {
  /** グラフデータと設定を更新 */
  GRAPH_UPDATE: 'graph:update',
  /** ビュー設定のみを更新 */
  VIEW_UPDATE: 'view:update',
  /** 特定のノードにフォーカス */
  NODE_FOCUS: 'node:focus',
  /** フォーカスをクリア */
  FOCUS_CLEAR: 'focus:clear'
};

/**
 * Webview → Extension メッセージタイプ
 */
export const WEBVIEW_TO_EXTENSION = {
  /** Webview初期化完了通知 */
  READY: 'ready',
  /** ノードクリック時のファイルオープン要求 */
  FOCUS_NODE: 'focusNode'
};

/**
 * メッセージを作成
 * @param {string} type - メッセージタイプ
 * @param {*} payload - ペイロード（省略可能）
 * @returns {Object} メッセージ
 */
export function createMessage(type, payload) {
  const message = { type };
  if (payload !== undefined) {
    message.payload = payload;
  }
  return message;
}

/**
 * メッセージを検証
 * @param {*} message - 検証対象のメッセージ
 * @returns {boolean} 有効なメッセージの場合true
 */
export function isValidMessage(message) {
  return message &&
    typeof message === 'object' &&
    typeof message.type === 'string';
}
