"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = exports.AUTO_ROTATE_DELAY = exports.COLORS = void 0;
exports.loadControls = loadControls;
exports.updateControl = updateControl;
exports.getTypeControlMap = getTypeControlMap;
exports.typeMatches = typeMatches;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const AnalyzerManager_1 = require("./AnalyzerManager");
exports.COLORS = {
    STACK_TRACE_LINK: '#51cf66',
    BACKGROUND_DARK: '#1a1a1a',
    NODE_DEFAULT: '#187bebff',
    EDGE_DEFAULT: '#4b5563'
};
exports.AUTO_ROTATE_DELAY = 1000;
const CONTROL_DEFAULTS = {
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
    analyzerId: AnalyzerManager_1.AnalyzerManager.getDefaultAnalyzerId()
};
const ANALYZER_CONFIG_RELATIVE_PATH = path.join('.vscode', 'dependviz', 'analyzer.json');
const STACKTRACE_CACHE_RELATIVE_PATH = path.join('.vscode', 'dependviz', 'stacktrace.json');
function getValueAtPath(target, pathParts) {
    return pathParts.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), target);
}
function setValueAtPath(target, pathParts, value) {
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
function deepMerge(target, source) {
    if (!source || typeof source !== 'object')
        return target;
    for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            deepMerge(target[key], value);
        }
        else {
            target[key] = value;
        }
    }
    return target;
}
function mergeWithDefaults(analyzerClass, overrides) {
    const base = analyzerClass ? analyzerClass.getTypeDefaults() : { filters: { node: {}, edge: {} }, colors: { node: {}, edge: {} } };
    return deepMerge(base, overrides || {});
}
function buildAnalyzerKeyMap(typeInfo) {
    const map = {};
    typeInfo.forEach(info => {
        map[info.filterKey] = ['filters', info.category, info.type];
        map[info.colorKey] = ['colors', info.category, info.type];
    });
    return map;
}
function buildTypeControlMap(typeInfo) {
    return typeInfo.reduce((acc, info) => {
        if (!acc[info.category]) {
            acc[info.category] = {};
        }
        acc[info.category][info.type] = info.filterKey;
        return acc;
    }, { node: {}, edge: {} });
}
/**
 * VS Code設定を一元管理するシングルトンクラス
 * 設定の読み書きを統一
 */
class ConfigurationManager {
    static getInstance() {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }
    constructor() {
        this._cache = null;
        this._cacheTime = 0;
        this._cacheDuration = 100; // ms
        this._observers = new Set();
        this._analyzerConfigCache = null;
        this._analyzerConfigMtime = 0;
        this._activeAnalyzerId = CONTROL_DEFAULTS.analyzerId;
        this._activeAnalyzerClass = AnalyzerManager_1.AnalyzerManager.getAnalyzerClassById(this._activeAnalyzerId);
        const typeInfo = this._activeAnalyzerClass.getTypeInfo();
        this._analyzerKeyMap = buildAnalyzerKeyMap(typeInfo);
        this._typeControlMap = buildTypeControlMap(typeInfo);
    }
    addObserver(observer) {
        if (typeof observer !== 'function') {
            return { dispose: () => { } };
        }
        this._observers.add(observer);
        return {
            dispose: () => this.removeObserver(observer)
        };
    }
    removeObserver(observer) {
        this._observers.delete(observer);
    }
    /**
     * 全設定を取得（キャッシュ付き）
     */
    loadControls(options = {}) {
        const { ignoreCache = false } = options;
        const now = Date.now();
        if (!ignoreCache && this._cache && (now - this._cacheTime) < this._cacheDuration) {
            return { ...this._cache }; // コピーを返す
        }
        const config = vscode.workspace.getConfiguration('forceGraphViewer');
        const controls = {};
        for (const [key, defaultValue] of Object.entries(CONTROL_DEFAULTS)) {
            controls[key] = config.get(key, defaultValue);
        }
        this._setActiveAnalyzer(controls.analyzerId || CONTROL_DEFAULTS.analyzerId);
        Object.assign(controls, this._loadAnalyzerControls());
        controls.COLORS = exports.COLORS;
        this._cache = controls;
        this._cacheTime = now;
        return { ...controls };
    }
    /**
     * 単一の設定を更新
     */
    async updateControl(key, value, target = vscode.ConfigurationTarget.Workspace) {
        if (this._isAnalyzerControlKey(key)) {
            await this._updateAnalyzerControls({ [key]: value });
        }
        else {
            const config = vscode.workspace.getConfiguration('forceGraphViewer');
            await config.update(key, value, target);
        }
        this._invalidateCache();
        this._emitChange();
    }
    /**
     * 複数の設定を一括更新
     */
    async updateControls(updates, target = vscode.ConfigurationTarget.Workspace) {
        const configUpdates = {};
        const analyzerUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (this._isAnalyzerControlKey(key)) {
                analyzerUpdates[key] = value;
            }
            else {
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
    getControl(key) {
        const controls = this.loadControls();
        return controls[key];
    }
    /**
     * キャッシュを無効化
     */
    _invalidateCache() {
        this._cache = null;
        this._cacheTime = 0;
        this._analyzerConfigCache = null;
        this._analyzerConfigMtime = 0;
    }
    _emitChange() {
        const controls = this.loadControls({ ignoreCache: true });
        this._notifyObservers(controls);
    }
    _notifyObservers(controls) {
        this._observers.forEach((observer) => {
            observer(controls);
        });
    }
    /**
     * テスト用：キャッシュをクリア
     */
    clearCache() {
        this._invalidateCache();
    }
    _setActiveAnalyzer(analyzerId) {
        const analyzerClass = AnalyzerManager_1.AnalyzerManager.getAnalyzerClassById(analyzerId);
        if (!analyzerClass)
            return;
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
    getTypeControlKey(type, category) {
        return this._typeControlMap[category]?.[type];
    }
    getTypeControlMap() {
        return this._typeControlMap;
    }
    /**
     * タイプが設定で有効かチェック
     */
    isTypeEnabled(type, category) {
        const controls = this.loadControls();
        const controlKey = this.getTypeControlKey(type, category);
        return controlKey ? controls[controlKey] : true;
    }
    _loadAnalyzerControls() {
        const stored = this._getStoredAnalyzerConfig();
        const merged = mergeWithDefaults(this._activeAnalyzerClass, stored);
        const controls = {};
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
    _isAnalyzerControlKey(key) {
        return Object.prototype.hasOwnProperty.call(this._analyzerKeyMap, key);
    }
    _getAnalyzerConfigPath() {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder)
            return null;
        return path.join(folder.uri.fsPath, ANALYZER_CONFIG_RELATIVE_PATH);
    }
    _getAnalyzerConfigData() {
        const filePath = this._getAnalyzerConfigPath();
        if (!filePath) {
            this._analyzerConfigCache = { analyzers: {} };
            this._analyzerConfigMtime = 0;
            return this._analyzerConfigCache;
        }
        let mtime = 0;
        try {
            mtime = fs.statSync(filePath).mtimeMs;
        }
        catch {
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
    _getStoredAnalyzerConfig() {
        const data = this._getAnalyzerConfigData();
        if (!data.analyzers[this._activeAnalyzerId]) {
            data.analyzers[this._activeAnalyzerId] = {};
        }
        return data.analyzers[this._activeAnalyzerId];
    }
    _loadAnalyzerConfigFromDisk(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed.analyzers && typeof parsed.analyzers === 'object') {
                return { analyzers: parsed.analyzers };
            }
            // backward compatibility: old format without analyzers map
            return { analyzers: { [CONTROL_DEFAULTS.analyzerId]: parsed } };
        }
        catch {
            return { analyzers: {} };
        }
    }
    async _updateAnalyzerControls(updates) {
        const filePath = this._ensureAnalyzerConfigFile();
        if (!filePath)
            return;
        const data = this._getAnalyzerConfigData();
        if (!data.analyzers[this._activeAnalyzerId]) {
            data.analyzers[this._activeAnalyzerId] = {};
        }
        const target = data.analyzers[this._activeAnalyzerId];
        for (const [key, value] of Object.entries(updates)) {
            const pathParts = this._analyzerKeyMap[key];
            if (!pathParts)
                continue;
            setValueAtPath(target, pathParts, value);
        }
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
        try {
            const stat = fs.statSync(filePath);
            this._analyzerConfigMtime = stat.mtimeMs;
        }
        catch {
            this._analyzerConfigMtime = Date.now();
        }
        this._analyzerConfigCache = data;
    }
    _ensureAnalyzerConfigFile() {
        const filePath = this._getAnalyzerConfigPath();
        if (!filePath)
            return null;
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify({ analyzers: {} }, null, 4), 'utf8');
        }
        return filePath;
    }
    _getCallStackCachePath() {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder)
            return null;
        return path.join(folder.uri.fsPath, STACKTRACE_CACHE_RELATIVE_PATH);
    }
    _ensureCallStackCacheFile() {
        const filePath = this._getCallStackCachePath();
        if (!filePath)
            return null;
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify({ traces: [] }, null, 4), 'utf8');
        }
        return filePath;
    }
    _loadCallStackCacheFromDisk(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
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
        }
        catch {
            // ignore
        }
        return [];
    }
    getCallStackCache() {
        const filePath = this._getCallStackCachePath();
        if (!filePath) {
            return [];
        }
        if (!fs.existsSync(filePath)) {
            return [];
        }
        return this._loadCallStackCacheFromDisk(filePath);
    }
    async updateCallStackCache(entries) {
        const filePath = this._ensureCallStackCacheFile();
        if (!filePath)
            return;
        const data = { traces: Array.isArray(entries) ? entries : [] };
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
    }
    handleAnalyzerConfigExternalChange() {
        this._invalidateCache();
        this._emitChange();
    }
}
exports.ConfigurationManager = ConfigurationManager;
ConfigurationManager.instance = null;
// ヘルパー関数（後方互換性のため）
function loadControls() {
    return ConfigurationManager.getInstance().loadControls();
}
async function updateControl(key, value) {
    return ConfigurationManager.getInstance().updateControl(key, value);
}
function getTypeControlMap() {
    return ConfigurationManager.getInstance().getTypeControlMap();
}
function typeMatches(type, controls, category) {
    const map = getTypeControlMap();
    const controlKey = map[category]?.[type];
    return controlKey ? controls[controlKey] : true;
}
//# sourceMappingURL=ConfigurationManager.js.map