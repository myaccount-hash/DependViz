import type {
  VsCodeApi,
  JsonRpcMessage,
  MessageHandlers,
  GraphViewModel
} from './types';

// Declare VS Code API available in webview context
declare function acquireVsCodeApi(): VsCodeApi;

/**
 * 拡張機能とWebView間の通信を管理するシングルトンクラス
 */
class ExtensionBridge {
  private static instance: ExtensionBridge | null = null;

  private state: GraphViewModel;
  private vscode: VsCodeApi | null = null;
  private handlers: MessageHandlers;

  static getInstance(state?: GraphViewModel): ExtensionBridge | null {
    if (!ExtensionBridge.instance && state) {
      ExtensionBridge.instance = new ExtensionBridge(state);
    }
    return ExtensionBridge.instance;
  }

  private constructor(state: GraphViewModel) {
    this.state = state;
    this.handlers = {
      'graph:update': (params) => this.state.handleGraphUpdate(params || {}),
      'view:update': (params) => this.state.handleViewUpdate(params || {}),
      'node:focus': (params) => this.state.focusNodeById(params || {}),
      'mode:toggle': () => this._handleToggleMode(),
      'focus:clear': () => this.state.clearFocus()
    };
  }

  // VSCode APIを初期化
  initialize(): VsCodeApi | null {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscode = acquireVsCodeApi();
    }
    if (!this.vscode) return null;

    window.addEventListener('message', (event: MessageEvent) => {
      this.handle(event.data);
    });

    this.send('ready');
    return this.vscode;
  }

  // メッセージを処理
  handle(message: unknown): void {
    if (!this.isValidMessage(message)) {
      return;
    }
    const handler = this.handlers[message.method];
    if (handler) {
      handler(message.params);
    } else if (message.method) {
      console.warn('[DependViz] Unknown message method:', message.method);
    }
  }

  // メッセージの型ガード
  private isValidMessage(message: unknown): message is JsonRpcMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      'jsonrpc' in message &&
      message.jsonrpc === '2.0' &&
      'method' in message &&
      typeof (message as JsonRpcMessage).method === 'string'
    );
  }

  // メッセージを送信
  send(method: string, params?: unknown): void {
    if (!this.vscode) return;
    const message: JsonRpcMessage = { jsonrpc: '2.0', method };
    if (params !== undefined) {
      message.params = params;
    }
    this.vscode.postMessage(message);
  }

  getVsCodeApi(): VsCodeApi | null {
    return this.vscode;
  }

  // モード切り替えを処理
  private _handleToggleMode(): void {
    const newMode = !this.state.controls.is3DMode;
    this.state.updateControls({ is3DMode: newMode });
    this.state.clearRenderer();
    this.state.updateGraph({ reheatSimulation: true });
  }
}

export default ExtensionBridge;
