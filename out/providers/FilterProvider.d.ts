import * as vscode from 'vscode';
import { BaseProvider, Controls } from './BaseProvider';
/**
 * フィルタ設定UIを提供するTreeDataProvider実装
 */
export declare class FilterProvider extends BaseProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | vscode.TreeItem | null | undefined>;
    get controls(): Controls;
    refresh(): void;
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem;
    getChildren(element?: vscode.TreeItem): vscode.TreeItem[];
    getRootItems(): vscode.TreeItem[];
    private _createAnalyzerSection;
    private _createFilterItems;
    createControlItem(type: string, label: string, key: string): vscode.TreeItem;
    handleSettingsChanged(controls: Controls | null): void;
}
//# sourceMappingURL=FilterProvider.d.ts.map