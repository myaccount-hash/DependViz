const vscode = require('vscode');
const BaseProvider = require('./BaseProvider');
const { CheckboxControlItem, SliderControlItem, SectionItem } = require('../utils/TreeItems');
const { SLIDER_RANGES } = require('../constants');

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
    constructor() {
        super();
    }

    getChildren(element) {
        if (!element) return this.getRootItems();
        if (element.contextValue === 'section' || element.contextValue === 'controlSection') {
            return element.children;
        }
        return [];
    }

    getRootItems() {
        return FILTER_SECTIONS.map(([label, ctrls]) =>
            new SectionItem(label, ctrls.map(c => this.createControlItem(c)), 'controlSection')
        );
    }

    createControlItem(c) {
        const [type, label, key, ...params] = c;
        const controls = this.controls;

        if (type === 'search') return new SearchControlItem(label, controls[key]);
        if (type === 'checkbox') return new CheckboxControlItem(label, controls[key], key);
        if (type === 'slider') {
            const range = params[0];
            return new SliderControlItem(label, controls[key], range.min, range.max, range.step, key);
        }

        throw new Error(`Unknown control type: ${type}`);
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
