"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphSettingsProvider = void 0;
const vscode = __importStar(require("vscode"));
const BaseProvider_1 = require("./BaseProvider");
const ConfigurationManager_1 = require("../ConfigurationManager");
/**
* 設定UIを提供するTreeDataProvider実装
*/
class GraphSettingsProvider extends BaseProvider_1.BaseProvider {
    constructor() {
        super(...arguments);
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    get controls() {
        if (this._controls && Object.keys(this._controls).length > 0) {
            return this._controls;
        }
        return ConfigurationManager_1.ConfigurationManager.getInstance().loadControls({ ignoreCache: true });
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element)
            return this.getRootItems();
        if (element.contextValue === 'section') {
            return element.children || [];
        }
        return [];
    }
    getRootItems() {
        return [
            new BaseProvider_1.SectionItem('表示設定', APPEARANCE_ITEMS.map(c => this.createControlItem(c))),
            new BaseProvider_1.SectionItem('詳細設定', DETAIL_ITEMS.map(c => this.createControlItem(c)))
        ];
    }
    createControlItem(c) {
        const [type, label, key] = c;
        const value = this.controls[key];
        if (type === 'search')
            return new BaseProvider_1.SearchControlItem(label, value);
        if (type === 'checkbox')
            return new BaseProvider_1.CheckboxControlItem(label, value, key);
        if (type === 'slider') {
            const range = c[3];
            return new BaseProvider_1.SliderControlItem(label, value, range.min, range.max, range.step, key);
        }
        throw new Error(`Unknown control type: ${type}`);
    }
    handleSettingsChanged(controls) {
        super.handleSettingsChanged(controls);
        this.refresh();
    }
}
exports.GraphSettingsProvider = GraphSettingsProvider;
const SLIDER_RANGES = {
    nodeSize: { min: 0, max: 20, step: 0.1 },
    linkWidth: { min: 0, max: 10, step: 0.1 },
    opacity: { min: 0, max: 2, step: 0.1 },
    linkDistance: { min: 10, max: 200, step: 5 },
    focusDistance: { min: 20, max: 300, step: 5 },
    arrowSize: { min: 0, max: 20, step: 1 },
    textSize: { min: 0, max: 24, step: 1 },
    sliceDepth: { min: 1, max: 10, step: 1 },
    dimOpacity: { min: 0, max: 10, step: 0.05 }
};
const APPEARANCE_ITEMS = [
    ['search', '検索', 'search'],
    ['checkbox', '3D表示', 'is3DMode'],
    ['checkbox', '行数反映', 'nodeSizeByLoc'],
    ['checkbox', 'コールスタック', 'showCallStack'],
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
//# sourceMappingURL=GraphSettingsProvider.js.map