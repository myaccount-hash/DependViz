const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const COLORS = {
    STACK_TRACE_LINK: '#51cf66',
    BACKGROUND_DARK: '#1a1a1a',
    NODE_DEFAULT: '#93c5fd',
    EDGE_DEFAULT: '#4b5563'
};

const AUTO_ROTATE_DELAY = 1000;

const CONTROL_DEFAULTS = {
    search: '',
    is3DMode: false,
    nodeSizeByLoc: false,
    hideIsolatedNodes: false,
    showStackTrace: true,
    showNames: true,
    shortNames: true,
    nodeSize: 3.0,
    linkWidth: 0.5,
    nodeOpacity: 1.0,
    edgeOpacity: 0.6,
    dimOpacity: 0.2,
    linkDistance: 50,
    focusDistance: 120,
    arrowSize: 3,
    textSize: 12,
    sliceDepth: 3,
    enableForwardSlice: true,
    enableBackwardSlice: true
};

const ANALYZER_CONFIG_RELATIVE_PATH = path.join('.vscode', 'dependviz', 'analyzer.json');

const ANALYZER_DEFAULTS = {
    filters: {
        node: {
            Class: true,
            AbstractClass: true,
            Interface: true,
            Unknown: false
        },
        edge: {
            ObjectCreate: true,
            Extends: true,
            Implements: true,
            TypeUse: true,
            MethodCall: true
        }
    },
    colors: {
        node: {
            Class: '#93c5fd',
            AbstractClass: '#d8b4fe',
            Interface: '#6ee7b7',
            Unknown: '#9ca3af'
        },
        edge: {
            ObjectCreate: '#fde047',
            Extends: '#d8b4fe',
            Implements: '#6ee7b7',
            TypeUse: '#fdba74',
            MethodCall: '#fda4af'
        }
    }
};

const FILTER_KEY_MAP = {
    showClass: ['filters', 'node', 'Class'],
    showAbstractClass: ['filters', 'node', 'AbstractClass'],
    showInterface: ['filters', 'node', 'Interface'],
    showUnknown: ['filters', 'node', 'Unknown'],
    showObjectCreate: ['filters', 'edge', 'ObjectCreate'],
    showExtends: ['filters', 'edge', 'Extends'],
    showImplements: ['filters', 'edge', 'Implements'],
    showTypeUse: ['filters', 'edge', 'TypeUse'],
    showMethodCall: ['filters', 'edge', 'MethodCall']
};

const COLOR_KEY_MAP = {
    colorClass: ['colors', 'node', 'Class'],
    colorAbstractClass: ['colors', 'node', 'AbstractClass'],
    colorInterface: ['colors', 'node', 'Interface'],
    colorUnknown: ['colors', 'node', 'Unknown'],
    colorObjectCreate: ['colors', 'edge', 'ObjectCreate'],
    colorExtends: ['colors', 'edge', 'Extends'],
    colorImplements: ['colors', 'edge', 'Implements'],
    colorTypeUse: ['colors', 'edge', 'TypeUse'],
    colorMethodCall: ['colors', 'edge', 'MethodCall']
};

const ANALYZER_KEY_MAP = { ...FILTER_KEY_MAP, ...COLOR_KEY_MAP };

function cloneAnalyzerDefaults() {
    return JSON.parse(JSON.stringify(ANALYZER_DEFAULTS));
}

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

function mergeWithDefaults(overrides) {
    const base = cloneAnalyzerDefaults();
    return deepMerge(base, overrides);
}

/**
 * ノード・エッジタイプと設定キーのマッピング
 */
const TYPE_CONTROL_MAP = {
    node: {
        'Class': 'showClass',
        'AbstractClass': 'showAbstractClass',
        'Interface': 'showInterface',
        'Unknown': 'showUnknown'
    },
    edge: {
        'ObjectCreate': 'showObjectCreate',
        'Extends': 'showExtends',
        'Implements': 'showImplements',
        'TypeUse': 'showTypeUse',
        'MethodCall': 'showMethodCall'
    }
};

/**
 * VS Code設定を一元管理するシングルトンクラス
 * - 設定の読み書きを統一
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
        this._cache = null;
        this._cacheTime = 0;
        this._cacheDuration = 100; // ms
        this._onDidChange = new vscode.EventEmitter();
        this._analyzerConfigCache = null;
        this._analyzerConfigMtime = 0;
    }

    get onDidChange() {
        return this._onDidChange.event;
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
        Object.assign(controls, this._loadAnalyzerControls());
        controls.COLORS = COLORS;

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
        if (!this._onDidChange) {
            return;
        }
        const controls = this.loadControls({ ignoreCache: true });
        this._onDidChange.fire(controls);
    }

    /**
     * テスト用：キャッシュをクリア
     */
    clearCache() {
        this._invalidateCache();
    }

    /**
     * ノード/エッジタイプに対応する設定キーを取得
     */
    getTypeControlKey(type, category) {
        return TYPE_CONTROL_MAP[category]?.[type];
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
        const analyzerConfig = this._getAnalyzerConfig();
        const controls = {};
        for (const [key, pathParts] of Object.entries(ANALYZER_KEY_MAP)) {
            const defaultValue = getValueAtPath(ANALYZER_DEFAULTS, pathParts);
            const value = getValueAtPath(analyzerConfig, pathParts);
            controls[key] = value !== undefined ? value : defaultValue;
        }
        controls.typeFilters = {
            node: { ...(analyzerConfig.filters?.node || {}) },
            edge: { ...(analyzerConfig.filters?.edge || {}) }
        };
        controls.typeColors = {
            node: { ...(analyzerConfig.colors?.node || {}) },
            edge: { ...(analyzerConfig.colors?.edge || {}) }
        };
        return controls;
    }

    _isAnalyzerControlKey(key) {
        return Object.prototype.hasOwnProperty.call(ANALYZER_KEY_MAP, key);
    }

    _getAnalyzerConfigPath() {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return null;
        return path.join(folder.uri.fsPath, ANALYZER_CONFIG_RELATIVE_PATH);
    }

    _getAnalyzerConfig() {
        const filePath = this._getAnalyzerConfigPath();
        if (!filePath) {
            this._analyzerConfigCache = cloneAnalyzerDefaults();
            this._analyzerConfigMtime = 0;
            return this._analyzerConfigCache;
        }

        let mtime = 0;
        try {
            mtime = fs.statSync(filePath).mtimeMs;
        } catch (e) {
            this._analyzerConfigCache = cloneAnalyzerDefaults();
            this._analyzerConfigMtime = 0;
            return this._analyzerConfigCache;
        }

        if (!this._analyzerConfigCache || this._analyzerConfigMtime !== mtime) {
            this._analyzerConfigCache = this._loadAnalyzerConfigFromDisk(filePath);
            this._analyzerConfigMtime = mtime;
        }
        return this._analyzerConfigCache;
    }

    _loadAnalyzerConfigFromDisk(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            return mergeWithDefaults(parsed);
        } catch (e) {
            return cloneAnalyzerDefaults();
        }
    }

    async _updateAnalyzerControls(updates) {
        const filePath = this._ensureAnalyzerConfigFile();
        if (!filePath) return;

        const nextConfig = mergeWithDefaults(this._getAnalyzerConfig());
        for (const [key, value] of Object.entries(updates)) {
            const pathParts = ANALYZER_KEY_MAP[key];
            if (!pathParts) continue;
            setValueAtPath(nextConfig, pathParts, value);
        }

        await fs.promises.writeFile(filePath, JSON.stringify(nextConfig, null, 4), 'utf8');
        try {
            const stat = fs.statSync(filePath);
            this._analyzerConfigMtime = stat.mtimeMs;
        } catch (e) {
            this._analyzerConfigMtime = Date.now();
        }
        this._analyzerConfigCache = nextConfig;
    }

    _ensureAnalyzerConfigFile() {
        const filePath = this._getAnalyzerConfigPath();
        if (!filePath) return null;
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(cloneAnalyzerDefaults(), null, 4), 'utf8');
        }
        return filePath;
    }

    handleAnalyzerConfigExternalChange() {
        this._invalidateCache();
        this._emitChange();
    }
}

// ヘルパー関数（後方互換性のため）
function loadControls() {
    return ConfigurationManager.getInstance().loadControls();
}

async function updateControl(key, value) {
    return ConfigurationManager.getInstance().updateControl(key, value);
}

function getTypeControlMap() {
    return TYPE_CONTROL_MAP;
}

function typeMatches(type, controls, category) {
    const controlKey = TYPE_CONTROL_MAP[category]?.[type];
    return controlKey ? controls[controlKey] : true;
}

module.exports = {
    ConfigurationManager,
    loadControls,
    updateControl,
    getTypeControlMap,
    typeMatches,
    COLORS,
    AUTO_ROTATE_DELAY
};
