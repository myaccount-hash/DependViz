const vscode = require('vscode');
const ConfigurationObserver = require('../configuration/ConfigurationObserver');
const ConfigurationSubject = require('../configuration/ConfigurationSubject');

/**
 * Providerの設定更新を統一する基底クラス
 * Observer Pattern: Observer（観察者）の実装
 *
 * ConfigurationSubjectから設定変更通知を受け取り、
 * サブクラスで利用可能な設定を管理する
 */
class BaseProvider extends ConfigurationObserver {
    constructor() {
        super();
        this._controls = null;
    }

    /**
     * 設定変更通知を受け取る（Observer Pattern: update）
     *
     * @param {Object} controls - 更新された設定オブジェクト
     */
    update(controls) {
        this.handleSettingsChanged(controls);
    }

    /**
     * 設定変更を処理
     * サブクラスでオーバーライドして独自の処理を追加可能
     *
     * @param {Object} controls - 更新された設定オブジェクト
     */
    handleSettingsChanged(controls) {
        this._controls = controls ? { ...controls } : null;
    }

    /**
     * 現在の設定を取得
     *
     * @returns {Object} 設定オブジェクト
     */
    get controls() {
        if (this._controls && Object.keys(this._controls).length > 0) {
            return this._controls;
        }
        return ConfigurationSubject.getInstance().loadControls();
    }

    async toggleCheckbox(key) {
        const configSubject = ConfigurationSubject.getInstance();
        const controls = this.controls;
        await configSubject.updateControls({ [key]: !controls[key] });
    }
}

class CheckboxControlItem extends vscode.TreeItem {
    constructor(label, checked, key) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'checkboxControl';
        this.key = key;
        this.checked = checked;
        this.iconPath = new vscode.ThemeIcon(checked ? 'check' : 'circle-outline');
        this.command = {
            command: 'forceGraphViewer.toggleCheckbox',
            title: 'Toggle',
            arguments: [key]
        };
    }
}

class SliderControlItem extends vscode.TreeItem {
    constructor(label, value, min, max, key) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'sliderControl';
        this.key = key;
        this.value = value;
        this.min = min;
        this.max = max;
        this.description = value.toString();
        this.command = {
            command: 'forceGraphViewer.showSliderInput',
            title: 'Adjust',
            arguments: [key, min, max, value]
        };
    }
}

class SectionItem extends vscode.TreeItem {
    constructor(label, children) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'section';
        this.children = children;
    }
}

class SearchControlItem extends vscode.TreeItem {
    constructor(label, value) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'searchControl';
        this.description = value || '検索...';
        this.command = {
            command: 'forceGraphViewer.showSearchInput',
            title: '検索'
        };
    }
}

module.exports = {
    BaseProvider,
    CheckboxControlItem,
    SliderControlItem,
    SectionItem,
    SearchControlItem
};
