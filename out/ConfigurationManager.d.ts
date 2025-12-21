import * as vscode from 'vscode';
export declare const COLORS: {
    STACK_TRACE_LINK: string;
    BACKGROUND_DARK: string;
    NODE_DEFAULT: string;
    EDGE_DEFAULT: string;
};
export declare const AUTO_ROTATE_DELAY = 1000;
interface ControlDefaults {
    search: string;
    is3DMode: boolean;
    nodeSizeByLoc: boolean;
    hideIsolatedNodes: boolean;
    showCallStack: boolean;
    callStackSelection: string[];
    showNames: boolean;
    shortNames: boolean;
    nodeSize: number;
    linkWidth: number;
    nodeOpacity: number;
    edgeOpacity: number;
    dimOpacity: number;
    linkDistance: number;
    focusDistance: number;
    arrowSize: number;
    textSize: number;
    sliceDepth: number;
    enableForwardSlice: boolean;
    enableBackwardSlice: boolean;
    analyzerId: string;
    [key: string]: any;
}
export interface Controls extends ControlDefaults {
    COLORS?: typeof COLORS;
    typeFilters?: {
        node: Record<string, boolean>;
        edge: Record<string, boolean>;
    };
    typeColors?: {
        node: Record<string, string>;
        edge: Record<string, string>;
    };
}
interface CallStackEntry {
    id: string;
    sessionName: string;
    sessionType: string;
    capturedAt: number;
    classes: string[];
    paths: string[];
}
interface LoadControlsOptions {
    ignoreCache?: boolean;
}
/**
 * VS Code設定を一元管理するシングルトンクラス
 * 設定の読み書きを統一
 */
export declare class ConfigurationManager {
    private static instance;
    private _cache;
    private _cacheTime;
    private _cacheDuration;
    private _observers;
    private _analyzerConfigCache;
    private _analyzerConfigMtime;
    private _activeAnalyzerId;
    private _activeAnalyzerClass;
    private _analyzerKeyMap;
    private _typeControlMap;
    static getInstance(): ConfigurationManager;
    private constructor();
    addObserver(observer: (controls: Controls) => void): vscode.Disposable;
    removeObserver(observer: (controls: Controls) => void): void;
    /**
     * 全設定を取得（キャッシュ付き）
     */
    loadControls(options?: LoadControlsOptions): Controls;
    /**
     * 単一の設定を更新
     */
    updateControl(key: string, value: any, target?: vscode.ConfigurationTarget): Promise<void>;
    /**
     * 複数の設定を一括更新
     */
    updateControls(updates: Record<string, any>, target?: vscode.ConfigurationTarget): Promise<void>;
    /**
     * 単一の設定値を取得
     */
    getControl(key: string): any;
    /**
     * キャッシュを無効化
     */
    private _invalidateCache;
    private _emitChange;
    private _notifyObservers;
    /**
     * テスト用：キャッシュをクリア
     */
    clearCache(): void;
    private _setActiveAnalyzer;
    /**
     * ノード/エッジタイプに対応する設定キーを取得
     */
    getTypeControlKey(type: string, category: 'node' | 'edge'): string | undefined;
    getTypeControlMap(): {
        node: Record<string, string>;
        edge: Record<string, string>;
    };
    /**
     * タイプが設定で有効かチェック
     */
    isTypeEnabled(type: string, category: 'node' | 'edge'): boolean;
    private _loadAnalyzerControls;
    private _isAnalyzerControlKey;
    private _getAnalyzerConfigPath;
    private _getAnalyzerConfigData;
    private _getStoredAnalyzerConfig;
    private _loadAnalyzerConfigFromDisk;
    private _updateAnalyzerControls;
    private _ensureAnalyzerConfigFile;
    private _getCallStackCachePath;
    private _ensureCallStackCacheFile;
    private _loadCallStackCacheFromDisk;
    getCallStackCache(): CallStackEntry[];
    updateCallStackCache(entries: CallStackEntry[]): Promise<void>;
    handleAnalyzerConfigExternalChange(): void;
}
export declare function loadControls(): Controls;
export declare function updateControl(key: string, value: any): Promise<void>;
export declare function getTypeControlMap(): {
    node: Record<string, string>;
    edge: Record<string, string>;
};
export declare function typeMatches(type: string, controls: Controls, category: 'node' | 'edge'): boolean;
export {};
//# sourceMappingURL=ConfigurationManager.d.ts.map