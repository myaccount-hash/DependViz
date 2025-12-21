import * as vscode from 'vscode';
import { BaseProvider, CheckboxControlItem, SliderControlItem, SectionItem, SearchControlItem, Controls } from './BaseProvider';
import { ConfigurationManager } from '../ConfigurationManager';

type ControlType = 'search' | 'checkbox' | 'slider';

interface SliderRange {
    min: number;
    max: number;
    step: number;
}

interface SliderRanges {
    [key: string]: SliderRange;
}

type ControlDefinition = [ControlType, string, string] | [ControlType, string, string, SliderRange];

/**
* 設定UIを提供するTreeDataProvider実装
*/
export class GraphSettingsProvider extends BaseProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    get controls(): Controls {
        if (this._controls && Object.keys(this._controls).length > 0) {
            return this._controls;
        }
        return ConfigurationManager.getInstance().loadControls({ ignoreCache: true });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) return this.getRootItems();
        if (element.contextValue === 'section') {
            return (element as any).children || [];
        }
        return [];
    }

    getRootItems(): vscode.TreeItem[] {
        return [
            new SectionItem('表示設定', APPEARANCE_ITEMS.map(c => this.createControlItem(c))),
            new SectionItem('詳細設定', DETAIL_ITEMS.map(c => this.createControlItem(c)))
        ];
    }

    createControlItem(c: ControlDefinition): vscode.TreeItem {
        const [type, label, key] = c;
        const value = this.controls[key];
        if (type === 'search') return new SearchControlItem(label, value);
        if (type === 'checkbox') return new CheckboxControlItem(label, value, key);
        if (type === 'slider') {
            const range = c[3] as SliderRange;
            return new SliderControlItem(label, value, range.min, range.max, range.step, key);
        }
        throw new Error(`Unknown control type: ${type}`);
    }

    handleSettingsChanged(controls: Controls | null): void {
        super.handleSettingsChanged(controls);
        this.refresh();
    }
}


const SLIDER_RANGES: SliderRanges = {
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

const APPEARANCE_ITEMS: ControlDefinition[] = [
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

const DETAIL_ITEMS: ControlDefinition[] = [
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
