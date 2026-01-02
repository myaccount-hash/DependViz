const vscode = require('vscode');
const { BaseProvider, CheckboxControlItem, SectionItem } = require('./BaseProvider');
const AnalyzerContext = require('../analyzers/AnalyzerContext');
const ConfigurationSubject = require('../configuration/ConfigurationSubject');

/**
 * フィルタ設定UIを提供するTreeDataProvider実装
 * TODO: 色選択機能を追加
 */
class FilterProvider extends BaseProvider {
    constructor() {
        super();
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    registerCommands() {
        return [
            vscode.commands.registerCommand('forceGraphViewer.selectAnalyzer', async (analyzerId) => {
                await this.selectAnalyzer(analyzerId);
            })
        ];
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
        const analyzerId = this.controls.analyzerId || AnalyzerContext.getDefaultAnalyzerId();
        const analyzerOptions = AnalyzerContext.getAnalyzerOptions();
        const analyzerItems = analyzerOptions.map((option) => new AnalyzerChoiceItem(option, option.id === analyzerId));
        const items = [new SectionItem('Analyzer', analyzerItems)];
        items.push(...this._createFilterItems());
        return items;
    }

    _createFilterItems() {
        const analyzerId = this.controls.analyzerId || AnalyzerContext.getDefaultAnalyzerId();
        const analyzerClass = AnalyzerContext.getAnalyzerClassById(analyzerId);
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

    async selectAnalyzer(analyzerId) {
        if (typeof analyzerId === 'string' && analyzerId.length > 0) {
            const configSubject = ConfigurationSubject.getInstance();
            await configSubject.updateControls({ analyzerId });
        }
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
