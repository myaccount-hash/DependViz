const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const AnalyzerContext = require('../analyzers/AnalyzerContext');

const COLORS = {
    BACKGROUND_DARK: '#1a1a1a',
    NODE_DEFAULT: '#187bebff',
    EDGE_DEFAULT: '#4b5563'
};

const CONTROL_DEFAULTS = {
    search: '',
    is3DMode: false,
    nodeSizeByLoc: false,
    hideIsolatedNodes: false,
    showNames: true,
    shortNames: true,
    nodeSize: 3.0,
    linkWidth: 0.5,
    enableForceLayout: true,
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
    analyzerId: AnalyzerContext.getDefaultAnalyzerId()
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

/**
 * 設定データへのアクセスを提供するリポジトリクラス
 * Repository Pattern: データアクセス層の抽象化
 *
 * 責務:
 * 1. VSCode設定の読み書き
 * 2. ファイルベースのアナライザー設定の読み書き
 * 3. 設定のマージロジック
 * 4. アナライザー固有の設定管理
 */
class ConfigurationRepository {
    constructor() {
        this._setActiveAnalyzer(CONTROL_DEFAULTS.analyzerId);
    }

    /**
     * 設定をロード
     * VSCode設定とアナライザー設定をマージして返す
     *
     * @returns {Object} マージされた設定オブジェクト
     */
    loadConfiguration() {
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

    /**
     * 設定を更新
     * VSCode設定またはアナライザー設定に適切に保存
     *
     * @param {Object} updates - 更新する設定のキーと値のペア
     * @param {vscode.ConfigurationTarget} target - 設定のスコープ
     * @returns {Promise<void>}
     */
    async saveConfiguration(updates, target = vscode.ConfigurationTarget.Workspace) {
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
    }

    /**
     * アクティブなアナライザーを設定
     *
     * @param {string} id - アナライザーID
     * @private
     */
    _setActiveAnalyzer(id) {
        const cls = AnalyzerContext.getAnalyzerClassById(id);
        if (!cls || cls === this._activeAnalyzerClass) return;

        this._activeAnalyzerClass = cls;
        this._activeAnalyzerId = cls.analyzerId;
        this._analyzerKeyMap = buildAnalyzerKeyMap(cls.getTypeInfo());
    }

    /**
     * アナライザー固有の設定をロード
     *
     * @returns {Object} アナライザー設定
     * @private
     */
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

    /**
     * ワークスペースパスを取得
     *
     * @param {string} rel - 相対パス
     * @returns {string|null} 絶対パス
     * @private
     */
    _getWorkspacePath(rel) {
        const f = vscode.workspace.workspaceFolders?.[0];
        return f ? path.join(f.uri.fsPath, rel) : null;
    }

    /**
     * アナライザー設定ファイルからデータを読み込む
     *
     * @returns {Object} アナライザー設定データ
     * @private
     */
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

    /**
     * アナライザーエントリを確保
     *
     * @param {Object} data - アナライザー設定データ
     * @returns {Object} アナライザーエントリ
     * @private
     */
    _ensureAnalyzerEntry(data) {
        return data.analyzers[this._activeAnalyzerId] ??= {};
    }

    /**
     * アナライザー設定を更新
     *
     * @param {Object} updates - 更新内容
     * @returns {Promise<void>}
     * @private
     */
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
}

module.exports = {
    ConfigurationRepository,
    COLORS
};
