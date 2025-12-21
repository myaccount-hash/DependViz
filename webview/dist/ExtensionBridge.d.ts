import type { VsCodeApi, GraphViewModel } from './types';
/**
 * 拡張機能とWebView間の通信を管理するシングルトンクラス
 */
declare class ExtensionBridge {
    private static instance;
    private state;
    private vscode;
    private handlers;
    static getInstance(state?: GraphViewModel): ExtensionBridge | null;
    private constructor();
    initialize(): VsCodeApi | null;
    handle(message: unknown): void;
    private isValidMessage;
    send(method: string, params?: unknown): void;
    getVsCodeApi(): VsCodeApi | null;
    private _handleToggleMode;
}
export default ExtensionBridge;
//# sourceMappingURL=ExtensionBridge.d.ts.map