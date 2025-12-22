const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const AnalyzerManager = require('./AnalyzerManager');

const COLORS = {
    STACK_TRACE_LINK: '#51cf66',
    BACKGROUND_DARK: '#1a1a1a',
    NODE_DEFAULT: '#187bebff',
    EDGE_DEFAULT: '#4b5563'
};

const AUTO_ROTATE_DELAY = 1000;

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
    analyzerId: AnalyzerManager.getDefaultAnalyzerId()
};

const ANALYZER_CONFIG_RELATIVE_PATH = path.join('.vscode', 'dependviz', 'analyzer.json');
const STACK_TRACE_CACHE_RELATIVE_PATH = path.join('.vscode', 'dependviz', 'stacktrace.json');

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

/**
 * VS Code設定を一元管理するシングルトンクラス
 * 設定の読み書きを統一
 */
class ConfigurationManager {
    static instance = null;

    static getInstance() {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    constructor() {
        this._observers = new Set();
        this._activeAnalyzerId = CONTROL_DEFAULTS.analyzerId;
        this._activeAnalyzerClass = AnalyzerManager.getAnalyzerClassById(this._activeAnalyzerId);
        const typeInfo = this._activeAnalyzerClass.getTypeInfo();
        this._analyzerKeyMap = buildAnalyzerKeyMap(typeInfo);
    }

    addObserver(observer) {
        if (typeof observer !== 'function') {
            return { dispose: () => { } };
        }
        this._observers.add(observer);
        return {
            dispose: () => this._observers.delete(observer)
        };
    }

    /**
     * 全設定を取得
     */
    loadControls() {
        const config = vscode.workspace.getConfiguration('forceGraphViewer');
        const controls = {};
        for (const [key, defaultValue] of Object.entries(CONTROL_DEFAULTS)) {
            controls[key] = config.get(key, defaultValue);
        }
        this._setActiveAnalyzer(controls.analyzerId || CONTROL_DEFAULTS.analyzerId);
        Object.assign(controls, this._loadAnalyzerControls());
        controls.COLORS = COLORS;

        return { ...controls };
    }

    /**
     * 単一の設定を更新
     */
    async updateControl(key, value, target = vscode.ConfigurationTarget.Workspace) {
        await this.updateControls({ [key]: value }, target);
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
            } else {
                configUpdates[key] = value;
            }
        }
        await this._updateConfigControls(configUpdates, target);
        if (Object.keys(analyzerUpdates).length > 0) {
            await this._updateAnalyzerControls(analyzerUpdates);
        }
        this._emitChange();
    }

    _emitChange() {
        const controls = this.loadControls();
        this._notifyObservers(controls);
    }

    _notifyObservers(controls) {
        this._observers.forEach((observer) => {
            observer(controls);
        });
    }

    async _updateConfigControls(updates, target) {
        if (Object.keys(updates).length === 0) return;
        const config = vscode.workspace.getConfiguration('forceGraphViewer');
        for (const [key, value] of Object.entries(updates)) {
            await config.update(key, value, target);
        }
    }

    _setActiveAnalyzer(analyzerId) {
        const analyzerClass = AnalyzerManager.getAnalyzerClassById(analyzerId);
        if (!analyzerClass) return;
        if (this._activeAnalyzerClass && this._activeAnalyzerClass.analyzerId === analyzerClass.analyzerId) {
            return;
        }
        this._activeAnalyzerClass = analyzerClass;
        this._activeAnalyzerId = analyzerClass.analyzerId;
        const typeInfo = analyzerClass.getTypeInfo();
        this._analyzerKeyMap = buildAnalyzerKeyMap(typeInfo);
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
        if (!folder) return null;
        return path.join(folder.uri.fsPath, ANALYZER_CONFIG_RELATIVE_PATH);
    }

    _getAnalyzerConfigData() {
        const filePath = this._getAnalyzerConfigPath();
        if (!filePath) {
            return { analyzers: {} };
        }
        if (!fs.existsSync(filePath)) {
            return { analyzers: {} };
        }
        return this._loadAnalyzerConfigFromDisk(filePath);
    }

    _getStoredAnalyzerConfig() {
        const data = this._getAnalyzerConfigData();
        return this._ensureAnalyzerEntry(data);
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
        } catch (error) {
            return { analyzers: {} };
        }
    }

    _ensureAnalyzerEntry(data) {
        if (!data.analyzers[this._activeAnalyzerId]) {
            data.analyzers[this._activeAnalyzerId] = {};
        }
        return data.analyzers[this._activeAnalyzerId];
    }

    async _updateAnalyzerControls(updates) {
        const filePath = this._ensureAnalyzerConfigFile();
        if (!filePath) return;

        const data = this._getAnalyzerConfigData();
        const target = this._ensureAnalyzerEntry(data);
        for (const [key, value] of Object.entries(updates)) {
            const pathParts = this._analyzerKeyMap[key];
            if (!pathParts) continue;
            setValueAtPath(target, pathParts, value);
        }

        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
    }

    _ensureJsonFile(filePath, data) {
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        }
        return filePath;
    }

    _ensureAnalyzerConfigFile() {
        const filePath = this._getAnalyzerConfigPath();
        if (!filePath) return null;
        return this._ensureJsonFile(filePath, { analyzers: {} });
    }

    _getCallStackCachePath() {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return null;
        return path.join(folder.uri.fsPath, STACK_TRACE_CACHE_RELATIVE_PATH);
    }

    _ensureCallStackCacheFile() {
        const filePath = this._getCallStackCachePath();
        if (!filePath) return null;
        return this._ensureJsonFile(filePath, { traces: [] });
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
        } catch (error) {
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
        if (!filePath) return;

        const data = { traces: Array.isArray(entries) ? entries : [] };
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
    }

    handleAnalyzerConfigExternalChange() {
        this._emitChange();
    }
}

module.exports = {
    ConfigurationManager,
    COLORS,
    AUTO_ROTATE_DELAY
};
