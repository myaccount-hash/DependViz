const vscode = require('vscode');
const BaseProvider = require('./BaseProvider');
const { SectionItem } = require('../utils/TreeItems');

const FILTER_SECTIONS = [
    ['検索', [
        ['search', '検索', 'search']
    ]],
    ['ノードタイプ', [
        ['checkbox', 'Class', 'showClass'],
        ['checkbox', 'AbstractClass', 'showAbstractClass'],
        ['checkbox', 'Interface', 'showInterface'],
        ['checkbox', 'Unknown', 'showUnknown']
    ]],
    ['エッジタイプ', [
        ['checkbox', 'ObjectCreate', 'showObjectCreate'],
        ['checkbox', 'Extends', 'showExtends'],
        ['checkbox', 'Implements', 'showImplements'],
        ['checkbox', 'TypeUse', 'showTypeUse'],
        ['checkbox', 'MethodCall', 'showMethodCall']
    ]]
];

class FilterSettingsProvider extends BaseProvider {
    getRootItems() {
        return FILTER_SECTIONS.map(([label, ctrls]) =>
            new SectionItem(label, ctrls.map(c => this.createControlItem(c)), 'controlSection')
        );
    }

    createControlItem(c) {
        const [type, label, key] = c;
        if (type === 'search') return new SearchControlItem(label, this.controls[key]);
        return super.createControlItem(c);
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

module.exports = FilterSettingsProvider;
