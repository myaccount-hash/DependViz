const vscode = require('vscode');
const { DEFAULT_CONTROLS } = require('../constants');

/**
 * VS Code設定を一元管理するシングルトンクラス
 * - 設定の読み書きを統一
 * - 短期間のキャッシュでパフォーマンス向上
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
    }

    /**
     * 全設定を取得（キャッシュ付き）
     */
    loadControls() {
        const now = Date.now();
        if (this._cache && (now - this._cacheTime) < this._cacheDuration) {
            return { ...this._cache }; // コピーを返す
        }

        const config = vscode.workspace.getConfiguration('forceGraphViewer');
        const controls = {};
        for (const [key, defaultValue] of Object.entries(DEFAULT_CONTROLS)) {
            controls[key] = config.get(key, defaultValue);
        }

        this._cache = controls;
        this._cacheTime = now;
        return { ...controls };
    }

    /**
     * 単一の設定を更新
     */
    async updateControl(key, value, target = vscode.ConfigurationTarget.Workspace) {
        const config = vscode.workspace.getConfiguration('forceGraphViewer');
        await config.update(key, value, target);
        this._invalidateCache();
    }

    /**
     * 複数の設定を一括更新
     */
    async updateControls(updates, target = vscode.ConfigurationTarget.Workspace) {
        const config = vscode.workspace.getConfiguration('forceGraphViewer');
        for (const [key, value] of Object.entries(updates)) {
            await config.update(key, value, target);
        }
        this._invalidateCache();
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
    }

    /**
     * テスト用：キャッシュをクリア
     */
    clearCache() {
        this._invalidateCache();
    }
}

// ヘルパー関数（後方互換性のため）
function loadControls() {
    return ConfigurationManager.getInstance().loadControls();
}

async function updateControl(key, value) {
    return ConfigurationManager.getInstance().updateControl(key, value);
}

module.exports = {
    ConfigurationManager,
    loadControls,
    updateControl
};
