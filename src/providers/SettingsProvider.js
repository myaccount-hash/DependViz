const vscode = require('vscode');
const { SectionItem, CheckboxControlItem, SliderControlItem, ColorControlItem, ButtonControlItem } = require('../utils/TreeItems');
const { ConfigurationManager } = require('../utils/ConfigurationManager');
const { SLIDER_RANGES } = require('../constants');

// フィルタ設定
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

// 表示設定
const APPEARANCE_SECTIONS = [
    ['モード', [
        ['button', '2D/3D切り替え', 'forceGraphViewer.toggle3DMode']
    ]],
    ['表示設定', [
        ['checkbox', 'スタックトレース', 'showStackTrace'],
        ['checkbox', '名前を表示', 'showNames'],
        ['checkbox', '短縮名を表示', 'shortNames'],
        ['checkbox', '孤立ノードを非表示', 'hideIsolatedNodes'],
        ['checkbox', 'ノードサイズをLOCで決定', 'nodeSizeByLoc']
    ]],
    ['スライス設定', [
        ['checkbox', '順方向スライス', 'enableForwardSlice'],
        ['checkbox', '逆方向スライス', 'enableBackwardSlice'],
        ['slider', 'スライス深度', 'sliceDepth', SLIDER_RANGES.sliceDepth]
    ]]
];

// 詳細設定
const DETAIL_SECTIONS = [
   ['サイズ・透明度', [
      ['slider', 'ノードサイズ', 'nodeSize', SLIDER_RANGES.nodeSize],
      ['slider', 'リンク幅', 'linkWidth', SLIDER_RANGES.linkWidth],
      ['slider', 'ノード透明度', 'nodeOpacity', SLIDER_RANGES.opacity],
      ['slider', 'エッジ透明度', 'edgeOpacity', SLIDER_RANGES.opacity],
      ['slider', '矢印サイズ', 'arrowSize', SLIDER_RANGES.arrowSize],
      ['slider', 'テキストサイズ', 'textSize', SLIDER_RANGES.textSize]
   ]],
   ['レイアウト', [
      ['slider', 'リンク距離', 'linkDistance', SLIDER_RANGES.linkDistance]
   ]],
   ['ノード色', [
      ['color', 'Class', 'colorClass'],
      ['color', 'AbstractClass', 'colorAbstractClass'],
      ['color', 'Interface', 'colorInterface'],
      ['color', 'Unknown', 'colorUnknown']
   ]],
   ['エッジ色', [
      ['color', 'ObjectCreate', 'colorObjectCreate'],
      ['color', 'Extends', 'colorExtends'],
      ['color', 'Implements', 'colorImplements'],
      ['color', 'TypeUse', 'colorTypeUse'],
      ['color', 'MethodCall', 'colorMethodCall']
   ]]
];

/**
 * 統合された設定プロバイダー
 * - フィルタ、表示モード、詳細設定を1つのプロバイダーで管理
 */
class SettingsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    get controls() {
        return ConfigurationManager.getInstance().loadControls();
    }

    async _updateControls(data) {
        if (data && typeof data === 'object' && 'key' in data && 'value' in data) {
            await ConfigurationManager.getInstance().updateControl(data.key, data.value);
        }
    }

    async update(data) {
        if (data && data.key && 'value' in data) {
            await this._updateControls(data);
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
        if (element.contextValue === 'section' || element.contextValue === 'controlSection') {
            return element.children;
        }
        return [];
    }

    getRootItems() {
        // すべてのセクションを統合
        const allSections = [
            ...FILTER_SECTIONS,
            ...APPEARANCE_SECTIONS,
            ...DETAIL_SECTIONS
        ];

        return allSections.map(([label, ctrls]) =>
            new SectionItem(label, ctrls.map(c => this.createControlItem(c)), 'controlSection')
        );
    }

    createControlItem(c) {
        const [type, label, key] = c;
        if (type === 'search') return new SearchControlItem(label, this.controls[key]);
        if (type === 'checkbox') return new CheckboxControlItem(label, this.controls[key], key);
        if (type === 'slider') {
            const range = c[3];
            return new SliderControlItem(label, this.controls[key], range.min, range.max, range.step, key);
        }
        if (type === 'color') return new ColorControlItem(label, this.controls[key], key);
        if (type === 'button') return new ButtonControlItem(label, key);

        throw new Error(`Unknown control type: ${type}`);
    }
}

/**
 * 検索コントロールアイテム
 */
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
