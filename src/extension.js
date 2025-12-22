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
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const pattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '.vscode/dependviz/analyzer.json');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const handler = () => configManager.handleAnalyzerConfigExternalChange();
        watcher.onDidChange(handler);
        watcher.onDidCreate(handler);
        watcher.onDidDelete(handler);
        context.subscriptions.push(watcher);
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
            let selectionChanged = true;
            if (nextSelection.length === lastCallStackSelectionValue.length) {
                const sortedNext = [...nextSelection].sort();
                const sortedCurrent = [...lastCallStackSelectionValue].sort();
                selectionChanged = !sortedNext.every((value, index) => value === sortedCurrent[index]);
            }
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
    console.log('DependViz extension deactivated');
}

module.exports = {
    activate,
    deactivate
};
