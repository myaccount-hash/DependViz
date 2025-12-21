import * as vscode from 'vscode';
import { BaseProvider, Controls } from './BaseProvider';
import { GraphData } from '../utils/utils';
interface UpdateData {
    type: string;
    paths?: string[];
    filePath?: string;
}
interface SyncOptions {
    viewOnly?: boolean;
}
/**
 * Graph Viewを提供するTreeDataProvider実装
 * 主にWebviewとの通信を管理する
 */
export declare class GraphViewProvider extends BaseProvider implements vscode.WebviewViewProvider {
    private _extensionUri;
    private _view;
    private _currentData;
    private _dataVersion;
    private _updateInProgress;
    private _pendingUpdate;
    private _callStackPaths;
    private _webviewBridge;
    constructor(extensionUri: vscode.Uri);
    private _getHtmlForWebview;
    resolveWebviewView(webviewView: vscode.WebviewView): Promise<void>;
    refresh(): Promise<void>;
    mergeGraphData(newData: GraphData): void;
    setGraphData(data: GraphData): void;
    update(data: UpdateData): Promise<void>;
    private _performUpdate;
    private _findNodeByFilePath;
    syncToWebview(options?: SyncOptions): void;
    focusNode(filePath: string): Promise<void>;
    toggle3DMode(): Promise<void>;
    handleSettingsChanged(controls: Controls | null): void;
    clearFocus(): Promise<void>;
}
export {};
//# sourceMappingURL=GraphViewProvider.d.ts.map