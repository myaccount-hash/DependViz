const vscode = require('vscode');
const { CheckboxControlItem, SliderControlItem, ColorControlItem } = require('../utils/TreeItems');
const { ConfigurationManager } = require('../utils/ConfigurationManager');
const { SLIDER_RANGES } = require('../constants');

const FILTER_ITEMS = [
    ['search', '検索', 'search'],
    ['checkbox', 'Node: Class', 'showClass'],
    ['checkbox', 'Node: AbstractClass', 'showAbstractClass'],
    ['checkbox', 'Node: Interface', 'showInterface'],
    ['checkbox', 'Node: Unknown', 'showUnknown'],
    ['checkbox', 'Link: ObjectCreate', 'showObjectCreate'],
    ['checkbox', 'Link: Extends', 'showExtends'],
    ['checkbox', 'Link: Implements', 'showImplements'],
    ['checkbox', 'Link: TypeUse', 'showTypeUse'],
    ['checkbox', 'Link: MethodCall', 'showMethodCall']
];

const APPEARANCE_ITEMS = [
    ['checkbox', '3D表示', 'is3DMode'],
    ['checkbox', '行数反映', 'nodeSizeByLoc'],
    ['checkbox', 'スタックトレース', 'showStackTrace'],
    ['checkbox', '名前表示', 'showNames'],
    ['checkbox', '短縮名表示', 'shortNames'],
    ['checkbox', '孤立ノード非表示', 'hideIsolatedNodes'],
    ['checkbox', '順方向スライス', 'enableForwardSlice'],
    ['checkbox', '逆方向スライス', 'enableBackwardSlice']
];

const DETAIL_ITEMS = [
    ['slider', 'スライス深度', 'sliceDepth', SLIDER_RANGES.sliceDepth],
    ['slider', 'リンク距離', 'linkDistance', SLIDER_RANGES.linkDistance],
    ['slider', 'フォーカス距離 (3D)', 'focusDistance', SLIDER_RANGES.focusDistance],
    ['slider', 'ノードサイズ', 'nodeSize', SLIDER_RANGES.nodeSize],
    ['slider', 'リンクサイズ', 'linkWidth', SLIDER_RANGES.linkWidth],
    ['slider', 'テキストサイズ', 'textSize', SLIDER_RANGES.textSize],
    ['slider', '矢印サイズ', 'arrowSize', SLIDER_RANGES.arrowSize],
    ['slider', '減光強度', 'dimOpacity', SLIDER_RANGES.dimOpacity],
    ['slider', 'ノード透明度', 'nodeOpacity', SLIDER_RANGES.opacity],
    ['slider', 'エッジ透明度', 'edgeOpacity', SLIDER_RANGES.opacity]
];

const COLOR_ITEMS = [
    ['color', 'Node: Class', 'colorClass'],
    ['color', 'Node: AbstractClass', 'colorAbstractClass'],
    ['color', 'Node: Interface', 'colorInterface'],
    ['color', 'Node: Unknown', 'colorUnknown'],
    ['color', 'Link: ObjectCreate', 'colorObjectCreate'],
    ['color', 'Link: Extends', 'colorExtends'],
    ['color', 'Link: Implements', 'colorImplements'],
    ['color', 'Link: TypeUse', 'colorTypeUse'],
    ['color', 'Link: MethodCall', 'colorMethodCall']
];

class SettingsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    get controls() {
        return ConfigurationManager.getInstance().loadControls();
    }

    async update(data) {
        if (data && data.key && 'value' in data) {
            await ConfigurationManager.getInstance().updateControl(data.key, data.value);
        }
        this._onDidChangeTreeData.fire();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) return this.getRootItems();
        if (element.contextValue === 'section') {
            return element.children;
        }
        return [];
    }

    getRootItems() {
        return [
            new SectionItem('フィルタ設定', FILTER_ITEMS.map(c => this.createControlItem(c))),
            new SectionItem('表示モード', APPEARANCE_ITEMS.map(c => this.createControlItem(c))),
            new SectionItem('詳細設定', DETAIL_ITEMS.map(c => this.createControlItem(c))),
            new SectionItem('色設定', COLOR_ITEMS.map(c => this.createControlItem(c)))
        ];
    }

    createControlItem(c) {
        const [type, label, key] = c;
        const value = this.controls[key];
        if (type === 'search') return new SearchControlItem(label, value);
        if (type === 'checkbox') return new CheckboxControlItem(label, value, key);
        if (type === 'slider') return new SliderControlItem(label, value, c[3].min, c[3].max, c[3].step, key);
        if (type === 'color') return new ColorControlItem(label, value, key);
        throw new Error(`Unknown control type: ${type}`);
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

module.exports = SettingsProvider;
