import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AnalyzerManager } from './AnalyzerManager';
import { TypeInfo, TypeDefaults } from './analyzers/BaseAnalyzer';

export const COLORS = {
    STACK_TRACE_LINK: '#51cf66',
    BACKGROUND_DARK: '#1a1a1a',
    NODE_DEFAULT: '#187bebff',
    EDGE_DEFAULT: '#4b5563'
};

export const AUTO_ROTATE_DELAY = 1000;

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

interface AnalyzerConfigData {
    analyzers: Record<string, any>;
}

interface CallStackCacheData {
    traces: CallStackEntry[];
}

interface LoadControlsOptions {
    ignoreCache?: boolean;
}

const CONTROL_DEFAULTS: ControlDefaults = {
    search: '',
    is3DMode: false,
    nodeSizeByLoc: false,
    hideIsolatedNodes: false,
    showCallStack: true,
    callStackSelection: [],
    showNames: true,
    shortNames: true,
    nodeSize: 3.0,
    linkWidth: 0.5,
    nodeOpacity: 1.0,
    edgeOpacity: 1.0,
    dimOpacity: 0.2,
    linkDistance: 50,
    focusDistance: 120,
    arrowSize: 3,
    textSize: 12,
    sliceDepth: 3,
    enableForwardSlice: true,
    enableBackwardSlice: true,
    analyzerId: AnalyzerManager.getDefaultAnalyzerId()
};

const ANALYZER_CONFIG_RELATIVE_PATH = path.join('.vscode', 'dependviz', 'analyzer.json');
const STACKTRACE_CACHE_RELATIVE_PATH = path.join('.vscode', 'dependviz', 'stacktrace.json');

function getValueAtPath(target: any, pathParts: string[]): any {
    return pathParts.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), target);
}

function setValueAtPath(target: any, pathParts: string[], value: any): void {
    let cursor = target;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const key = pathParts[i];
        if (!cursor[key] || typeof cursor[key] !== 'object') {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[pathParts[pathParts.length - 1]] = value;
}

function deepMerge(target: any, source: any): any {
    if (!source || typeof source !== 'object') return target;
    for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            deepMerge(target[key], value);
        } else {
            target[key] = value;
        }
    }
    return target;
}

function mergeWithDefaults(analyzerClass: any, overrides: any): TypeDefaults {
    const base = analyzerClass ? analyzerClass.getTypeDefaults() : { filters: { node: {}, edge: {} }, colors: { node: {}, edge: {} } };
    return deepMerge(base, overrides || {});
}

function buildAnalyzerKeyMap(typeInfo: TypeInfo[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    typeInfo.forEach(info => {
        map[info.filterKey] = ['filters', info.category, info.type];
        map[info.colorKey] = ['colors', info.category, info.type];
    });
    return map;
}

function buildTypeControlMap(typeInfo: TypeInfo[]): { node: Record<string, string>; edge: Record<string, string> } {
    return typeInfo.reduce((acc, info) => {
        if (!acc[info.category]) {
            acc[info.category] = {};
        }
        acc[info.category][info.type] = info.filterKey;
        return acc;
    }, { node: {}, edge: {} } as { node: Record<string, string>; edge: Record<string, string> });
}

/**
 * VS Code設定を一元管理するシングルトンクラス
 * 設定の読み書きを統一
 */
export class ConfigurationManager {
    private static instance: ConfigurationManager | null = null;

    private _cache: Controls | null = null;
    private _cacheTime = 0;
    private _cacheDuration = 100; // ms
    private _observers = new Set<(controls: Controls) => void>();
    private _analyzerConfigCache: AnalyzerConfigData | null = null;
    private _analyzerConfigMtime = 0;
    private _activeAnalyzerId: string;
    private _activeAnalyzerClass: any;
    private _analyzerKeyMap: Record<string, string[]>;
    private _typeControlMap: { node: Record<string, string>; edge: Record<string, string> };

    static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    private constructor() {
        this._activeAnalyzerId = CONTROL_DEFAULTS.analyzerId;
        this._activeAnalyzerClass = AnalyzerManager.getAnalyzerClassById(this._activeAnalyzerId);
        const typeInfo = this._activeAnalyzerClass.getTypeInfo();
        this._analyzerKeyMap = buildAnalyzerKeyMap(typeInfo);
        this._typeControlMap = buildTypeControlMap(typeInfo);
    }

    addObserver(observer: (controls: Controls) => void): vscode.Disposable {
        if (typeof observer !== 'function') {
            return { dispose: () => { } };
        }
        this._observers.add(observer);
        return {
            dispose: () => this.removeObserver(observer)
        };
    }

    removeObserver(observer: (controls: Controls) => void): void {
        this._observers.delete(observer);
    }

    /**
     * 全設定を取得（キャッシュ付き）
     */
    loadControls(options: LoadControlsOptions = {}): Controls {
        const { ignoreCache = false } = options;
        const now = Date.now();
        if (!ignoreCache && this._cache && (now - this._cacheTime) < this._cacheDuration) {
            return { ...this._cache }; // コピーを返す
        }

        const config = vscode.workspace.getConfiguration('forceGraphViewer');
        const controls: Controls = {} as Controls;
        for (const [key, defaultValue] of Object.entries(CONTROL_DEFAULTS)) {
            (controls as any)[key] = config.get(key, defaultValue);
        }
        this._setActiveAnalyzer(controls.analyzerId || CONTROL_DEFAULTS.analyzerId);
        Object.assign(controls, this._loadAnalyzerControls());
        controls.COLORS = COLORS;

        this._cache = controls;
        this._cacheTime = now;
        return { ...controls };
    }

    /**
     * 単一の設定を更新
     */
    async updateControl(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
        if (this._isAnalyzerControlKey(key)) {
            await this._updateAnalyzerControls({ [key]: value });
        } else {
            const config = vscode.workspace.getConfiguration('forceGraphViewer');
            await config.update(key, value, target);
        }
        this._invalidateCache();
        this._emitChange();
    }

    /**
     * 複数の設定を一括更新
     */
    async updateControls(updates: Record<string, any>, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
        const configUpdates: Record<string, any> = {};
        const analyzerUpdates: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (this._isAnalyzerControlKey(key)) {
                analyzerUpdates[key] = value;
            } else {
                configUpdates[key] = value;
            }
        }
        if (Object.keys(configUpdates).length > 0) {
            const config = vscode.workspace.getConfiguration('forceGraphViewer');
            for (const [key, value] of Object.entries(configUpdates)) {
                await config.update(key, value, target);
            }
        }
        if (Object.keys(analyzerUpdates).length > 0) {
            await this._updateAnalyzerControls(analyzerUpdates);
        }
        this._invalidateCache();
        this._emitChange();
    }

    /**
     * 単一の設定値を取得
     */
    getControl(key: string): any {
        const controls = this.loadControls();
        return controls[key];
    }

    /**
     * キャッシュを無効化
     */
    private _invalidateCache(): void {
        this._cache = null;
        this._cacheTime = 0;
        this._analyzerConfigCache = null;
        this._analyzerConfigMtime = 0;
    }

    private _emitChange(): void {
        const controls = this.loadControls({ ignoreCache: true });
        this._notifyObservers(controls);
    }

    private _notifyObservers(controls: Controls): void {
        this._observers.forEach((observer) => {
            observer(controls);
        });
    }

    /**
     * テスト用：キャッシュをクリア
     */
    clearCache(): void {
        this._invalidateCache();
    }

    private _setActiveAnalyzer(analyzerId: string): void {
        const analyzerClass = AnalyzerManager.getAnalyzerClassById(analyzerId);
        if (!analyzerClass) return;
        if (this._activeAnalyzerClass && this._activeAnalyzerClass.analyzerId === analyzerClass.analyzerId) {
            return;
        }
        this._activeAnalyzerClass = analyzerClass;
        this._activeAnalyzerId = analyzerClass.analyzerId;
        const typeInfo = analyzerClass.getTypeInfo();
        this._analyzerKeyMap = buildAnalyzerKeyMap(typeInfo);
        this._typeControlMap = buildTypeControlMap(typeInfo);
    }

    /**
     * ノード/エッジタイプに対応する設定キーを取得
     */
    getTypeControlKey(type: string, category: 'node' | 'edge'): string | undefined {
        return this._typeControlMap[category]?.[type];
    }

    getTypeControlMap(): { node: Record<string, string>; edge: Record<string, string> } {
        return this._typeControlMap;
    }

    /**
     * タイプが設定で有効かチェック
     */
    isTypeEnabled(type: string, category: 'node' | 'edge'): boolean {
        const controls = this.loadControls();
        const controlKey = this.getTypeControlKey(type, category);
        return controlKey ? controls[controlKey] : true;
    }

    private _loadAnalyzerControls(): Partial<Controls> {
        const stored = this._getStoredAnalyzerConfig();
        const merged = mergeWithDefaults(this._activeAnalyzerClass, stored);
        const controls: any = {};
        for (const [key, pathParts] of Object.entries(this._analyzerKeyMap)) {
            controls[key] = getValueAtPath(merged, pathParts);
        }
        controls.typeFilters = {
            node: { ...(merged.filters?.node || {}) },
            edge: { ...(merged.filters?.edge || {}) }
        };
        controls.typeColors = {
            node: { ...(merged.colors?.node || {}) },
            edge: { ...(merged.colors?.edge || {}) }
        };
        return controls;
    }

    private _isAnalyzerControlKey(key: string): boolean {
        return Object.prototype.hasOwnProperty.call(this._analyzerKeyMap, key);
    }

    private _getAnalyzerConfigPath(): string | null {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return null;
        return path.join(folder.uri.fsPath, ANALYZER_CONFIG_RELATIVE_PATH);
    }

    private _getAnalyzerConfigData(): AnalyzerConfigData {
        const filePath = this._getAnalyzerConfigPath();
        if (!filePath) {
            this._analyzerConfigCache = { analyzers: {} };
            this._analyzerConfigMtime = 0;
            return this._analyzerConfigCache;
        }

        let mtime = 0;
        try {
            mtime = fs.statSync(filePath).mtimeMs;
        } catch {
            this._analyzerConfigCache = { analyzers: {} };
            this._analyzerConfigMtime = 0;
            return this._analyzerConfigCache;
        }

        if (!this._analyzerConfigCache || this._analyzerConfigMtime !== mtime) {
            this._analyzerConfigCache = this._loadAnalyzerConfigFromDisk(filePath);
            this._analyzerConfigMtime = mtime;
        }
        return this._analyzerConfigCache;
    }

    private _getStoredAnalyzerConfig(): any {
        const data = this._getAnalyzerConfigData();
        if (!data.analyzers[this._activeAnalyzerId]) {
            data.analyzers[this._activeAnalyzerId] = {};
        }
        return data.analyzers[this._activeAnalyzerId];
    }

    private _loadAnalyzerConfigFromDisk(filePath: string): AnalyzerConfigData {
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed.analyzers && typeof parsed.analyzers === 'object') {
                return { analyzers: parsed.analyzers };
            }
            // backward compatibility: old format without analyzers map
            return { analyzers: { [CONTROL_DEFAULTS.analyzerId]: parsed } };
        } catch {
            return { analyzers: {} };
        }
    }

    private async _updateAnalyzerControls(updates: Record<string, any>): Promise<void> {
        const filePath = this._ensureAnalyzerConfigFile();
        if (!filePath) return;

        const data = this._getAnalyzerConfigData();
        if (!data.analyzers[this._activeAnalyzerId]) {
            data.analyzers[this._activeAnalyzerId] = {};
        }
        const target = data.analyzers[this._activeAnalyzerId];
        for (const [key, value] of Object.entries(updates)) {
            const pathParts = this._analyzerKeyMap[key];
            if (!pathParts) continue;
            setValueAtPath(target, pathParts, value);
        }

        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
        try {
            const stat = fs.statSync(filePath);
            this._analyzerConfigMtime = stat.mtimeMs;
        } catch {
            this._analyzerConfigMtime = Date.now();
        }
        this._analyzerConfigCache = data;
    }

    private _ensureAnalyzerConfigFile(): string | null {
        const filePath = this._getAnalyzerConfigPath();
        if (!filePath) return null;
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify({ analyzers: {} }, null, 4), 'utf8');
        }
        return filePath;
    }

    private _getCallStackCachePath(): string | null {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return null;
        return path.join(folder.uri.fsPath, STACKTRACE_CACHE_RELATIVE_PATH);
    }

    private _ensureCallStackCacheFile(): string | null {
        const filePath = this._getCallStackCachePath();
        if (!filePath) return null;
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify({ traces: [] }, null, 4), 'utf8');
        }
        return filePath;
    }

    private _loadCallStackCacheFromDisk(filePath: string): CallStackEntry[] {
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed: CallStackCacheData = JSON.parse(raw);
            if (Array.isArray(parsed.traces)) {
                return parsed.traces.map(entry => ({
                    id: entry.id,
                    sessionName: entry.sessionName,
                    sessionType: entry.sessionType,
                    capturedAt: entry.capturedAt,
                    classes: Array.isArray(entry.classes) ? [...entry.classes] : [],
                    paths: Array.isArray(entry.paths) ? [...entry.paths] : []
                }));
            }
        } catch {
            // ignore
        }
        return [];
    }

    getCallStackCache(): CallStackEntry[] {
        const filePath = this._getCallStackCachePath();
        if (!filePath) {
            return [];
        }
        if (!fs.existsSync(filePath)) {
            return [];
        }
        return this._loadCallStackCacheFromDisk(filePath);
    }

    async updateCallStackCache(entries: CallStackEntry[]): Promise<void> {
        const filePath = this._ensureCallStackCacheFile();
        if (!filePath) return;

        const data: CallStackCacheData = { traces: Array.isArray(entries) ? entries : [] };
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
    }

    handleAnalyzerConfigExternalChange(): void {
        this._invalidateCache();
        this._emitChange();
    }
}

// ヘルパー関数（後方互換性のため）
export function loadControls(): Controls {
    return ConfigurationManager.getInstance().loadControls();
}

export async function updateControl(key: string, value: any): Promise<void> {
    return ConfigurationManager.getInstance().updateControl(key, value);
}

export function getTypeControlMap(): { node: Record<string, string>; edge: Record<string, string> } {
    return ConfigurationManager.getInstance().getTypeControlMap();
}

export function typeMatches(type: string, controls: Controls, category: 'node' | 'edge'): boolean {
    const map = getTypeControlMap();
    const controlKey = map[category]?.[type];
    return controlKey ? controls[controlKey] : true;
}
