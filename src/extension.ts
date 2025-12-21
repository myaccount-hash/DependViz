import * as vscode from 'vscode';
import { GraphViewProvider } from './providers/GraphViewProvider';
import { FilterProvider } from './providers/FilterProvider';
import { GraphSettingsProvider } from './providers/GraphSettingsProvider';
import { CallStackProvider } from './providers/CallStackProvider';
import { ConfigurationManager, Controls } from './ConfigurationManager';
import { registerCommands } from './commands';
import { AnalyzerManager } from './AnalyzerManager';

process.env.VSCODE_DISABLE_TELEMETRY = '1';

// グローバルなAnalyzerManagerインスタンス
let analyzerManager: AnalyzerManager | null = null;

export function activate(context: vscode.ExtensionContext): void {
    const settingsProvider = new GraphSettingsProvider();
    const filterProvider = new FilterProvider();
    const graphViewProvider = new GraphViewProvider(context.extensionUri);
    const callStackProvider = new CallStackProvider();

    vscode.window.createTreeView('forceGraphViewer.settings', { treeDataProvider: settingsProvider });
    vscode.window.createTreeView('forceGraphViewer.filters', { treeDataProvider: filterProvider });
    vscode.window.createTreeView('forceGraphViewer.callStack', { treeDataProvider: callStackProvider });
    vscode.window.registerWebviewViewProvider('forceGraphViewer.sidebar', graphViewProvider);

    const configManager = ConfigurationManager.getInstance();
    let lastCallStackSelectionValue: string[] = [];
    const analyzerWatcher = createAnalyzerConfigWatcher(configManager);
    if (analyzerWatcher) {
        context.subscriptions.push(analyzerWatcher);
    }
    const broadcastSettings = (controlsOverride?: Controls | null): Controls => {
        const controls = controlsOverride || configManager.loadControls({ ignoreCache: true });
        settingsProvider.handleSettingsChanged(controls);
        filterProvider.handleSettingsChanged(controls);
        graphViewProvider.handleSettingsChanged(controls);
        return controls;
    };

    const initialControls = broadcastSettings();
    lastCallStackSelectionValue = Array.isArray(initialControls.callStackSelection) ? [...initialControls.callStackSelection] : [];
    if (initialControls.showCallStack) {
        callStackProvider.restore(graphViewProvider);
        callStackProvider.update(graphViewProvider);
    }

    analyzerManager = new AnalyzerManager(context, configManager);

    const providers = {
        settingsProvider,
        filterProvider,
        graphViewProvider,
        callStackProvider,
        analyzerManager
    };

    const commands = registerCommands(context, providers);

    const eventHandlers: vscode.Disposable[] = [
        configManager.addObserver(async (controls: Controls) => {
            const nextControls = broadcastSettings(controls);
            const nextSelection = Array.isArray(nextControls.callStackSelection)
                ? [...nextControls.callStackSelection]
                : [];
            const selectionChanged = !areCallStackSelectionsEqual(nextSelection, lastCallStackSelectionValue);
            lastCallStackSelectionValue = nextSelection;
            if (nextControls.showCallStack && !selectionChanged) {
                await callStackProvider.update(graphViewProvider);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(async (editor: vscode.TextEditor | undefined) => {
            if (editor?.document.uri.scheme === 'file') {
                await graphViewProvider.update({ type: 'focusNode', filePath: editor.document.uri.fsPath });
            }
        }),
        vscode.window.onDidChangeActiveColorTheme(() => broadcastSettings()),
        vscode.debug.onDidChangeActiveStackItem(async (stackItem: vscode.DebugThread | vscode.DebugStackFrame | undefined) => {
            const controls = broadcastSettings();
            if (controls.showCallStack && stackItem && 'frameId' in stackItem) {
                await callStackProvider.update(graphViewProvider);
            }
        }),
        vscode.debug.onDidStartDebugSession(async () => {
            const controls = broadcastSettings();
            if (controls.showCallStack) {
                await callStackProvider.update(graphViewProvider);
            }
        }),
        vscode.debug.onDidTerminateDebugSession(() => {
            const controls = broadcastSettings();
            if (controls.showCallStack) {
                graphViewProvider.update({ type: 'callStack', paths: [] });
            }
        })
    ];

    context.subscriptions.push(...commands, ...eventHandlers);
}

export async function deactivate(): Promise<void> {
    if (analyzerManager) {
        await analyzerManager.stopAll();
    }

    // リソースクリーンアップ
    // context.subscriptions に登録された全てのリソースは
    // VSCode が自動的に dispose() を呼び出すため、
    // 明示的なクリーンアップは不要
    console.log('DependViz extension deactivated');
}

function createAnalyzerConfigWatcher(configManager: ConfigurationManager): vscode.FileSystemWatcher | null {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return null;
    }
    const pattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '.vscode/dependviz/analyzer.json');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const handler = (): void => configManager.handleAnalyzerConfigExternalChange();
    watcher.onDidChange(handler);
    watcher.onDidCreate(handler);
    watcher.onDidDelete(handler);
    return watcher;
}

function areCallStackSelectionsEqual(a: string[] = [], b: string[] = []): boolean {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
}
