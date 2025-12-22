const vscode = require('vscode');
const GraphViewProvider = require('./providers/GraphViewProvider');
const FilterProvider = require('./providers/FilterProvider');
const GraphSettingsProvider = require('./providers/GraphSettingsProvider');
const CallStackProvider = require('./providers/CallStackProvider');
const { ConfigurationManager } = require('./ConfigurationManager');
const { registerCommands } = require('./commands');
const AnalyzerManager = require('./AnalyzerManager');

process.env.VSCODE_DISABLE_TELEMETRY = '1';

// グローバルなAnalyzerManagerインスタンス
let analyzerManager = null;

function activate(context) {
    const settingsProvider = new GraphSettingsProvider();
    const filterProvider = new FilterProvider();
    const graphViewProvider = new GraphViewProvider(context.extensionUri);
    const callStackProvider = new CallStackProvider();

    vscode.window.createTreeView('forceGraphViewer.settings', { treeDataProvider: settingsProvider });
    vscode.window.createTreeView('forceGraphViewer.filters', { treeDataProvider: filterProvider });
    vscode.window.createTreeView('forceGraphViewer.callStack', { treeDataProvider: callStackProvider });
    vscode.window.registerWebviewViewProvider('forceGraphViewer.sidebar', graphViewProvider);

    const configManager = ConfigurationManager.getInstance();
    let lastCallStackSelectionValue;
    const analyzerWatcher = createAnalyzerConfigWatcher(configManager);
    if (analyzerWatcher) {
        context.subscriptions.push(analyzerWatcher);
    }
    const broadcastSettings = (controlsOverride) => {
        const controls = controlsOverride || configManager.loadControls();
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

    const commands = registerCommands(providers);

    const eventHandlers = [
        configManager.addObserver(async (controls) => {
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
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor?.document.uri.scheme === 'file') {
                await graphViewProvider.update({ type: 'focusNode', filePath: editor.document.uri.fsPath });
            }
        }),
        vscode.window.onDidChangeActiveColorTheme(() => broadcastSettings()),
        vscode.debug.onDidChangeActiveStackItem(async (stackItem) => {
            const controls = broadcastSettings();
            if (controls.showCallStack && stackItem) {
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

async function deactivate() {
    if (analyzerManager) {
        await analyzerManager.stopAll();
    }

    // リソースクリーンアップ
    // context.subscriptions に登録された全てのリソースは
    // VSCode が自動的に dispose() を呼び出すため、
    // 明示的なクリーンアップは不要
    console.log('DependViz extension deactivated');
}

module.exports = {
    activate,
    deactivate
};

function createAnalyzerConfigWatcher(configManager) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return null;
    }
    const pattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '.vscode/dependviz/analyzer.json');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const handler = () => configManager.handleAnalyzerConfigExternalChange();
    watcher.onDidChange(handler);
    watcher.onDidCreate(handler);
    watcher.onDidDelete(handler);
    return watcher;
}

function areCallStackSelectionsEqual(current = [], next = []) {
    if (!Array.isArray(current) || !Array.isArray(next)) return false;
    if (current.length !== next.length) return false;
    const sortedCurrent = [...current].sort();
    const sortedNext = [...next].sort();
    return sortedCurrent.every((value, index) => value === sortedNext[index]);
}
