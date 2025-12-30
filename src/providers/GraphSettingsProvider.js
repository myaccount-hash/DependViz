const vscode = require('vscode');
const { BaseProvider, CheckboxControlItem, SliderControlItem, SearchControlItem } = require('./BaseProvider');
const ConfigurationSubject = require('../configuration/ConfigurationSubject');


/**
* 設定UIを提供するTreeDataProvider実装
*/
class GraphSettingsProvider extends BaseProvider {
    constructor() {
        super();
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    registerCommands() {
        return [
            vscode.commands.registerCommand('forceGraphViewer.showSearchInput', async () => {
                await this.showSearchInput();
            }),
            vscode.commands.registerCommand('forceGraphViewer.toggleCheckbox', async (key) => {
                await this.toggleCheckbox(key);
            }),
            vscode.commands.registerCommand('forceGraphViewer.showSliderInput', async (key, min, max, currentValue) => {
                await this.showSliderInput(key, min, max, currentValue);
            }),
            vscode.commands.registerCommand('forceGraphViewer.forwardSlice', async () => {
                await this.enableSlice('forward');
            }),
            vscode.commands.registerCommand('forceGraphViewer.backwardSlice', async () => {
                await this.enableSlice('backward');
            }),
            vscode.commands.registerCommand('forceGraphViewer.clearSlice', async () => {
                await this.clearSlice();
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
        if (!element) {
            return SETTINGS_ITEMS.map(item => {
                const [type, label, key] = item;
                const value = this.controls[key];
                if (type === 'search') return new SearchControlItem(label, value);
                if (type === 'checkbox') return new CheckboxControlItem(label, value, key);
                if (type === 'slider') return new SliderControlItem(label, value, item[3].min, item[3].max, key);
                throw new Error(`Unknown control type: ${type}`);
            });
        }
        return [];
    }

    handleSettingsChanged(controls) {
        super.handleSettingsChanged(controls);
        this.refresh();
    }

    async showSearchInput() {
        const controls = this.controls;
        const value = await vscode.window.showInputBox({
            prompt: '検索クエリ (例: Test, name:/Test.*/, type:Class AND name:Util, path:/.*Service/ OR NOT type:Unknown)',
            value: controls.search,
            placeHolder: '検索... (name:, type:, path: フィールド指定可, /正規表現/, AND/OR/NOT 演算可)'
        });
        if (value !== undefined) {
            const configSubject = ConfigurationSubject.getInstance();
            await configSubject.updateControls({ search: value });
        }
    }

    async showSliderInput(key, min, max, currentValue) {
        const value = await vscode.window.showInputBox({
            prompt: `${key} (${min} - ${max})`,
            value: currentValue.toString(),
            validateInput: (input) => {
                const num = parseFloat(input);
                return isNaN(num) || num < min || num > max
                    ? `値は ${min} から ${max} の間で入力してください`
                    : null;
            }
        });
        if (value !== undefined) {
            const configSubject = ConfigurationSubject.getInstance();
            await configSubject.updateControls({ [key]: parseFloat(value) });
        }
    }

    async enableSlice(direction) {
        const key = direction === 'forward' ? 'enableForwardSlice' : 'enableBackwardSlice';
        const configSubject = ConfigurationSubject.getInstance();
        await configSubject.updateControls({ [key]: true });
    }

    async clearSlice() {
        const configSubject = ConfigurationSubject.getInstance();
        await configSubject.updateControls({ enableForwardSlice: false, enableBackwardSlice: false });
    }
}


const SLIDER_RANGES = {
    nodeSize: { min: 0, max: 20 },
    linkWidth: { min: 0, max: 10 },
    opacity: { min: 0, max: 2 },
    linkDistance: { min: 10, max: 200 },
    focusDistance: { min: 20, max: 300 },
    arrowSize: { min: 0, max: 20 },
    textSize: { min: 0, max: 24 },
    sliceDepth: { min: 1, max: 10 },
    dimOpacity: { min: 0, max: 10 }
};

const SETTINGS_ITEMS = [
    ['search', '検索', 'search'],
    ['checkbox', '3D表示', 'is3DMode'],
    ['checkbox', '力学レイアウト', 'enableForceLayout'],
    ['checkbox', '行数反映', 'nodeSizeByLoc'],
    ['checkbox', '名前表示', 'showNames'],
    ['checkbox', '短縮名表示', 'shortNames'],
    ['checkbox', '孤立ノード非表示', 'hideIsolatedNodes'],
    ['checkbox', '順方向スライス', 'enableForwardSlice'],
    ['checkbox', '逆方向スライス', 'enableBackwardSlice'],
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

module.exports = GraphSettingsProvider;
