const vscode = require('vscode');
const { BaseProvider, CheckboxControlItem, SectionItem } = require('./BaseProvider');
const AnalyzerManager = require('../analyzers/AnalyzerManager');

/**
 * フィルタ設定UIを提供するTreeDataProvider実装
 */
class FilterProvider extends BaseProvider {
    constructor() {
        super();
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
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
        const analyzerId = this.controls.analyzerId || AnalyzerManager.getDefaultAnalyzerId();
        const analyzerOptions = AnalyzerManager.getAnalyzerOptions();
        const analyzerItems = analyzerOptions.map((option) => new AnalyzerChoiceItem(option, option.id === analyzerId));
        const items = [new SectionItem('Analyzer', analyzerItems)];
        items.push(...this._createFilterItems());
        return items;
    }

    _createFilterItems() {
        const analyzerId = this.controls.analyzerId || AnalyzerManager.getDefaultAnalyzerId();
        const analyzerClass = AnalyzerManager.getAnalyzerClassById(analyzerId);
        const typeInfo = analyzerClass.getTypeInfo();
        const nodes = typeInfo.filter(info => info.category === 'node');
        const edges = typeInfo.filter(info => info.category === 'edge');
        const makeControlItem = (label, key) => {
            const value = this.controls[key];
            return new CheckboxControlItem(label, value, key);
        };
        const makeItem = (info) => {
            const prefix = info.category === 'node' ? 'Node' : 'Link';
            return makeControlItem(`${prefix}: ${info.type}`, info.filterKey);
        };
        return [...nodes.map(makeItem), ...edges.map(makeItem)];
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
