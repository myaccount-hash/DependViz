import * as vscode from 'vscode';
import { BaseProvider, Controls } from './BaseProvider';
type ControlType = 'search' | 'checkbox' | 'slider';
interface SliderRange {
    min: number;
    max: number;
    step: number;
}
type ControlDefinition = [ControlType, string, string] | [ControlType, string, string, SliderRange];
/**
* 設定UIを提供するTreeDataProvider実装
*/
export declare class GraphSettingsProvider extends BaseProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | vscode.TreeItem | null | undefined>;
    get controls(): Controls;
    refresh(): void;
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem;
    getChildren(element?: vscode.TreeItem): vscode.TreeItem[];
    getRootItems(): vscode.TreeItem[];
    createControlItem(c: ControlDefinition): vscode.TreeItem;
    handleSettingsChanged(controls: Controls | null): void;
}
export {};
//# sourceMappingURL=GraphSettingsProvider.d.ts.map