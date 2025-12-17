const vscode = require('vscode');
const { BaseProvider, CheckboxControlItem } = require('./BaseProvider');
const { ConfigurationManager } = require('../utils/ConfigurationManager');
const JavaAnalyzer = require('../analyzers/JavaAnalyzer');

const FILTER_ITEMS = JavaAnalyzer.getTypeInfo().map(info => {
    const prefix = info.category === 'node' ? 'Node' : 'Link';
    return ['checkbox', `${prefix}: ${info.type}`, info.filterKey];
});

/**
 * フィルタ設定UIを提供するTreeDataProvider実装
 * Analyzerに唯一依存する
 */
class FilterProvider extends BaseProvider {
    constructor() {
        super();
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    get controls() {
        if (this._controls && Object.keys(this._controls).length > 0) {
            return this._controls;
        }
        return ConfigurationManager.getInstance().loadControls({ ignoreCache: true });
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) return this.getRootItems();
        return [];
    }

    getRootItems() {
        return FILTER_ITEMS.map(([type, label, key]) => this.createControlItem(type, label, key));
    }

    createControlItem(type, label, key) {
        const value = this.controls[key];
        if (type === 'checkbox') {
            return new CheckboxControlItem(label, value, key);
        }
        throw new Error(`Unknown control type: ${type}`);
    }

    handleSettingsChanged(controls) {
        super.handleSettingsChanged(controls);
        this.refresh();
    }
}

module.exports = FilterProvider;
