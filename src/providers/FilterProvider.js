const vscode = require('vscode');
const { BaseProvider, CheckboxControlItem, SectionItem } = require('./BaseProvider');
const { ConfigurationManager } = require('../utils/ConfigurationManager');
const { getAnalyzerClassById, getAnalyzerOptions, getDefaultAnalyzerId } = require('../analyzers');

/**
 * フィルタ設定UIを提供するTreeDataProvider実装
 * Providerの中で唯一Analyzerの情報を参照する
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
        if (element.children && Array.isArray(element.children)) {
            return element.children;
        }
        return [];
    }

    getRootItems() {
        const items = [this._createAnalyzerSection()];
        items.push(...this._createFilterItems());
        return items;
    }

    _createAnalyzerSection() {
        const analyzerId = this.controls.analyzerId || getDefaultAnalyzerId();
        const children = getAnalyzerOptions().map((option) => new AnalyzerChoiceItem(option, option.id === analyzerId));
        return new SectionItem('Analyzer', children);
    }

    _createFilterItems() {
        const analyzerId = this.controls.analyzerId || getDefaultAnalyzerId();
        const analyzerClass = getAnalyzerClassById(analyzerId);
        const typeInfo = analyzerClass.getTypeInfo();
        const nodes = typeInfo.filter(info => info.category === 'node');
        const edges = typeInfo.filter(info => info.category === 'edge');
        const makeItem = (info) => {
            const prefix = info.category === 'node' ? 'Node' : 'Link';
            return this.createControlItem('checkbox', `${prefix}: ${info.type}`, info.filterKey);
        };
        return [...nodes.map(makeItem), ...edges.map(makeItem)];
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

class AnalyzerChoiceItem extends vscode.TreeItem {
    constructor(option, isActive) {
        super(option.label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'analyzerChoice';
        this.iconPath = new vscode.ThemeIcon(isActive ? 'check' : 'circle-outline');
        this.command = {
            command: 'forceGraphViewer.selectAnalyzer',
            title: 'Select Analyzer',
            arguments: [option.id]
        };
    }
}

module.exports = FilterProvider;
