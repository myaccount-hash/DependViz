import * as vscode from 'vscode';
interface GraphViewProvider {
    update(data: {
        type: string;
        paths: string[];
    }): Promise<void>;
}
export declare class CallStackProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _sessions;
    private _configManager;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | vscode.TreeItem | null | undefined>;
    private _lastSavedSignature;
    constructor();
    update(graphViewProvider: GraphViewProvider): Promise<void>;
    clear(): Promise<void>;
    restore(graphViewProvider: GraphViewProvider): void;
    removeSession(sessionId: string | undefined, graphViewProvider?: GraphViewProvider): Promise<void>;
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem;
    getChildren(): vscode.TreeItem[];
    private _createInfoItem;
    private _createSessionItem;
    private _buildTooltip;
    private _buildEntry;
    private _getSelectedSessionIds;
    private _getCallStackPathsForCurrentSelection;
    private _emitCallStackPaths;
    notifySelectionChanged(graphViewProvider: GraphViewProvider): Promise<void>;
    private _extractPaths;
    private _extractClasses;
    private _deriveClassName;
    private _computeSignature;
    private _persistSessions;
    private _loadCache;
    private _getAllSessions;
}
export {};
//# sourceMappingURL=CallStackProvider.d.ts.map