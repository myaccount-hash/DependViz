const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const AnalyzerManager = require('./analyzers/AnalyzerManager');

const COLORS = {
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

/* utility */

const getByPath = (obj, parts) =>
    parts.reduce((c, p) => (c && c[p] !== undefined ? c[p] : undefined), obj);

const setByPath = (obj, parts, value) => {
    let c = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        c = c[parts[i]] ??= {};
    }
    c[parts.at(-1)] = value;
};

const merge = (a, b) => {
    if (!b || typeof b !== 'object') return a;
    for (const [k, v] of Object.entries(b)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            a[k] = merge(a[k] ?? {}, v);
        } else {
            a[k] = v;
        }
    }
    return a;
};

const buildAnalyzerKeyMap = (typeInfo) =>
    Object.fromEntries(
        typeInfo.flatMap(i => [
            [i.filterKey, ['filters', i.category, i.type]],
            [i.colorKey, ['colors', i.category, i.type]]
        ])
    );

/* manager */

class ConfigurationManager {
    static instance;

    static getInstance() {
        return this.instance ??= new ConfigurationManager();
    }

    constructor() {
        this._observers = new Set();
        this._setActiveAnalyzer(CONTROL_DEFAULTS.analyzerId);
    }

    addObserver(fn) {
        if (typeof fn !== 'function') return { dispose() {} };
        this._observers.add(fn);
        return { dispose: () => this._observers.delete(fn) };
    }

    loadControls() {
        const cfg = vscode.workspace.getConfiguration('forceGraphViewer');
        const controls = Object.fromEntries(
            Object.entries(CONTROL_DEFAULTS).map(
                ([k, d]) => [k, cfg.get(k, d)]
            )
        );

        this._setActiveAnalyzer(controls.analyzerId);
        Object.assign(controls, this._loadAnalyzerControls());
        controls.COLORS = COLORS;

        return controls;
    }

    async updateControls(updates, target = vscode.ConfigurationTarget.Workspace) {
        const cfg = vscode.workspace.getConfiguration('forceGraphViewer');
        const analyzerUpdates = {};

        for (const [k, v] of Object.entries(updates)) {
            if (this._analyzerKeyMap[k]) {
                analyzerUpdates[k] = v;
            } else {
                await cfg.update(k, v, target);
            }
        }

        if (Object.keys(analyzerUpdates).length) {
            await this._updateAnalyzerControls(analyzerUpdates);
        }

        this._emitChange();
    }

    _emitChange() {
        const c = this.loadControls();
        this._observers.forEach(o => o(c));
    }

    _setActiveAnalyzer(id) {
        const cls = AnalyzerManager.getAnalyzerClassById(id);
        if (!cls || cls === this._activeAnalyzerClass) return;

        this._activeAnalyzerClass = cls;
        this._activeAnalyzerId = cls.analyzerId;
        this._analyzerKeyMap = buildAnalyzerKeyMap(cls.getTypeInfo());
    }

    _loadAnalyzerControls() {
        const base = this._activeAnalyzerClass.getTypeDefaults();
        const stored = this._ensureAnalyzerEntry(this._getAnalyzerConfigData());
        const merged = merge(structuredClone(base), stored);

        const controls = {};
        for (const [k, p] of Object.entries(this._analyzerKeyMap)) {
            controls[k] = getByPath(merged, p);
        }

        controls.typeFilters = {
            node: { ...merged.filters?.node },
            edge: { ...merged.filters?.edge }
        };
        controls.typeColors = {
            node: { ...merged.colors?.node },
            edge: { ...merged.colors?.edge }
        };

        return controls;
    }

    _getWorkspacePath(rel) {
        const f = vscode.workspace.workspaceFolders?.[0];
        return f ? path.join(f.uri.fsPath, rel) : null;
    }

    _getAnalyzerConfigData() {
        const p = this._getWorkspacePath(ANALYZER_CONFIG_RELATIVE_PATH);
        if (!p || !fs.existsSync(p)) return { analyzers: {} };
        try {
            const j = JSON.parse(fs.readFileSync(p, 'utf8'));
            return j.analyzers ? j : { analyzers: { [CONTROL_DEFAULTS.analyzerId]: j } };
        } catch {
            return { analyzers: {} };
        }
    }

    _ensureAnalyzerEntry(data) {
        return data.analyzers[this._activeAnalyzerId] ??= {};
    }

    async _updateAnalyzerControls(updates) {
        const p = this._getWorkspacePath(ANALYZER_CONFIG_RELATIVE_PATH);
        if (!p) return;

        if (!fs.existsSync(p)) {
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify({ analyzers: {} }, null, 4));
        }

        const data = this._getAnalyzerConfigData();
        const target = this._ensureAnalyzerEntry(data);

        for (const [k, v] of Object.entries(updates)) {
            setByPath(target, this._analyzerKeyMap[k], v);
        }

        await fs.promises.writeFile(p, JSON.stringify(data, null, 4));
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
