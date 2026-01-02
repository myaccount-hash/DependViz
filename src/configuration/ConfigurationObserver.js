/**
 * 設定変更を受け取るオブザーバーのインターフェース
 * Observer Pattern: Observer（観察者）
 *
 * ConfigurationSubjectから設定変更の通知を受け取る
 */
class ConfigurationObserver {
    /**
     * 設定変更通知を受け取る
     * サブクラスでこのメソッドをオーバーライドして、設定変更時の処理を実装
     *
     * @param {Object} configuration - 更新された設定オブジェクト
     * @abstract
     */
    // eslint-disable-next-line no-unused-vars
    update(configuration) {
        throw new Error('ConfigurationObserver.update() must be implemented by subclass');
    }
}

module.exports = ConfigurationObserver;
