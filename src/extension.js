const vscode = require('vscode');
const GraphViewProvider = require('./providers/GraphViewProvider');
const FilterProvider = require('./providers/FilterProvider');
const GraphSettingsProvider = require('./providers/GraphSettingsProvider');
const ConfigurationSubject = require('./configuration/ConfigurationSubject');
const { registerCommands } = require('./commands');
const AnalyzerContext = require('./analyzers/AnalyzerContext');

process.env.VSCODE_DISABLE_TELEMETRY = '1';

// グローバルなAnalyzerContextインスタンス
let analyzerManager = null;

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

    // アナライザー設定ファイルの監視
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const pattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '.vscode/dependviz/analyzer.json');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const handler = () => configSubject.handleAnalyzerConfigExternalChange();
        watcher.onDidChange(handler);
        watcher.onDidCreate(handler);
        watcher.onDidDelete(handler);
        context.subscriptions.push(watcher);
    }

    // 初期設定をロードして全Providerに通知
    const initialControls = configSubject.loadControls();
    settingsProvider.update(initialControls);
    filterProvider.update(initialControls);
    graphViewProvider.update(initialControls);

    analyzerManager = new AnalyzerContext(context, configSubject);

    const providers = {
        settingsProvider,
        filterProvider,
        graphViewProvider,
        analyzerManager
    };

    const commands = registerCommands(providers);

    const eventHandlers = [
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor?.document.uri.scheme === 'file') {
                await graphViewProvider.handleDataUpdate({ type: 'focusNode', filePath: editor.document.uri.fsPath });
            }
        }),
        vscode.window.onDidChangeActiveColorTheme(() => {
            // 色テーマ変更時は全Providerに設定を再ロードして通知
            const controls = configSubject.loadControls();
            settingsProvider.update(controls);
            filterProvider.update(controls);
            graphViewProvider.update(controls);
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
