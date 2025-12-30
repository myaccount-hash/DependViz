const vscode = require('vscode');
const GraphViewProvider = require('./providers/GraphViewProvider');
const FilterProvider = require('./providers/FilterProvider');
const GraphSettingsProvider = require('./providers/GraphSettingsProvider');
const ConfigurationSubject = require('./configuration/ConfigurationSubject');
const { registerCommands } = require('./commands');
const AnalyzerContext = require('./analyzers/AnalyzerContext');

process.env.VSCODE_DISABLE_TELEMETRY = '1';

function setupFileWatcher(context, configSubject) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }

    const pattern = new vscode.RelativePattern(
        vscode.workspace.workspaceFolders[0],
        '.vscode/dependviz/analyzer.json'
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const handler = () => configSubject.handleAnalyzerConfigExternalChange();

    watcher.onDidChange(handler);
    watcher.onDidCreate(handler);
    watcher.onDidDelete(handler);

    context.subscriptions.push(watcher);
}

function setupEventHandlers(graphViewProvider, configSubject) {
    return [
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor?.document.uri.scheme === 'file') {
                await graphViewProvider.handleDataUpdate({ type: 'focusNode', filePath: editor.document.uri.fsPath });
            }
        }),
        vscode.window.onDidChangeActiveColorTheme(() => {
            configSubject.notifyAll();
        })
    ];
}

function activate(context) {
    const settingsProvider = new GraphSettingsProvider();
    const filterProvider = new FilterProvider();
    const graphViewProvider = new GraphViewProvider(context.extensionUri);

    vscode.window.createTreeView('forceGraphViewer.settings', { treeDataProvider: settingsProvider });
    vscode.window.createTreeView('forceGraphViewer.filters', { treeDataProvider: filterProvider });
    vscode.window.registerWebviewViewProvider('forceGraphViewer.sidebar', graphViewProvider);

    const configSubject = ConfigurationSubject.getInstance();

    // Observer Pattern: ProviderをObserverとして登録
    configSubject.attach(settingsProvider);
    configSubject.attach(filterProvider);
    configSubject.attach(graphViewProvider);

    setupFileWatcher(context, configSubject);

    // 初期設定を全Providerに通知
    configSubject.notifyAll();

    const analyzerManager = new AnalyzerContext(context, configSubject);

    const providers = {
        settingsProvider,
        filterProvider,
        graphViewProvider,
        analyzerManager
    };

    const commands = registerCommands(providers);
    const providerCommands = [
        ...settingsProvider.registerCommands(),
        ...filterProvider.registerCommands(),
        ...graphViewProvider.registerCommands()
    ];
    const eventHandlers = setupEventHandlers(graphViewProvider, configSubject);

    context.subscriptions.push(...commands, ...providerCommands, ...eventHandlers, analyzerManager);
}

function deactivate() {
    console.log('DependViz extension deactivated');
}

module.exports = {
    activate,
    deactivate
};
