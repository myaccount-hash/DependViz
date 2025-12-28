const vscode = require('vscode');
const { ConfigurationRepository } = require('./ConfigurationRepository');

/**
 * 設定変更を通知するSubjectクラス
 * Observer Pattern: Subject（被観察者）
 *
 * 責務:
 * 1. ConfigurationObserverの管理（attach/detach）
 * 2. 設定変更時の通知（notify）
 * 3. ConfigurationRepositoryを使用したデータアクセスのコーディネート
 */
class ConfigurationSubject {
    static _instance;

    /**
     * Singleton インスタンスを取得
     *
     * @returns {ConfigurationSubject}
     */
    static getInstance() {
        return this._instance ??= new ConfigurationSubject();
    }

    constructor() {
        /** @type {Set<ConfigurationObserver>} */
        this._observers = new Set();

        /** @type {ConfigurationRepository} */
        this._repository = new ConfigurationRepository();
    }

    /**
     * オブザーバーを登録
     * Observer Pattern: attach
     *
     * @param {ConfigurationObserver} observer - 登録するオブザーバー
     * @returns {vscode.Disposable} オブザーバーの登録を解除するためのDisposable
     */
    attach(observer) {
        if (!observer || typeof observer.update !== 'function') {
            console.warn('Invalid observer provided to ConfigurationSubject.attach');
            return { dispose() {} };
        }

        this._observers.add(observer);
        return {
            dispose: () => this.detach(observer)
        };
    }

    /**
     * オブザーバーの登録を解除
     * Observer Pattern: detach
     *
     * @param {ConfigurationObserver} observer - 解除するオブザーバー
     */
    detach(observer) {
        this._observers.delete(observer);
    }

    /**
     * 全オブザーバーに設定変更を通知
     * Observer Pattern: notify
     */
    notifyAll() {
        const controls = this.loadControls();
        this._observers.forEach(observer => {
            try {
                observer.update(controls);
            } catch (error) {
                console.error('Error notifying observer:', error);
            }
        });
    }

    /**
     * 設定をロード
     * Repositoryから設定を取得
     *
     * @returns {Object} 設定オブジェクト
     */
    loadControls() {
        return this._repository.loadConfiguration();
    }

    /**
     * 設定を更新
     * Repositoryに設定を保存し、オブザーバーに通知
     *
     * @param {Object} updates - 更新する設定のキーと値のペア
     * @param {vscode.ConfigurationTarget} target - 設定のスコープ
     * @returns {Promise<void>}
     */
    async updateControls(updates, target = vscode.ConfigurationTarget.Workspace) {
        await this._repository.saveConfiguration(updates, target);
        this.notifyAll();
    }

    /**
     * アナライザー設定の外部変更を処理
     * ファイル監視などから呼び出される
     */
    handleAnalyzerConfigExternalChange() {
        this.notifyAll();
    }

    // ===== 後方互換性のためのメソッド =====

    /**
     * 関数をオブザーバーとして登録（後方互換性のため）
     * @deprecated Use attach() with ConfigurationObserver instead
     *
     * @param {Function} fn - 設定変更時に呼び出される関数
     * @returns {vscode.Disposable}
     */
    addObserver(fn) {
        if (typeof fn !== 'function') {
            return { dispose() {} };
        }

        // 関数をConfigurationObserverインターフェースに適合させる
        const observer = {
            update: fn
        };

        return this.attach(observer);
    }
}

module.exports = ConfigurationSubject;
