const vscode = require('vscode');
const GraphViewProvider = require('./providers/GraphViewProvider');
const FilterProvider = require('./providers/FilterProvider');
const GraphSettingsProvider = require('./providers/GraphSettingsProvider');
const StackTraceProvider = require('./providers/StackTraceProvider');
const { ConfigurationManager } = require('./utils/ConfigurationManager');
const { registerCommands } = require('./commands');
const JavaAnalyzer = require('./analyzers/JavaAnalyzer');
const JavaScriptAnalyzer = require('./analyzers/JavaScriptAnalyzer');

process.env.VSCODE_DISABLE_TELEMETRY = '1';

// グローバルなLanguage Client インスタンス
let javaAnalyzer = null;
let javascriptAnalyzer = null;

function activate(context) {
    const settingsProvider = new GraphSettingsProvider();
    const filterProvider = new FilterProvider();
    const graphViewProvider = new GraphViewProvider(context.extensionUri);
    const stackTraceProvider = new StackTraceProvider();

    // Analyzer インスタンスを初期化
    javaAnalyzer = new JavaAnalyzer(context);
    javascriptAnalyzer = new JavaScriptAnalyzer();

    vscode.window.createTreeView('forceGraphViewer.settings', { treeDataProvider: settingsProvider });
    vscode.window.createTreeView('forceGraphViewer.filters', { treeDataProvider: filterProvider });
    vscode.window.createTreeView('forceGraphViewer.stackTrace', { treeDataProvider: stackTraceProvider });
    vscode.window.registerWebviewViewProvider('forceGraphViewer.sidebar', graphViewProvider);

    const configManager = ConfigurationManager.getInstance();
    const analyzerWatcher = createAnalyzerConfigWatcher(configManager);
    if (analyzerWatcher) {
        context.subscriptions.push(analyzerWatcher);
    }
    const broadcastSettings = (controlsOverride) => {
        const controls = controlsOverride || configManager.loadControls({ ignoreCache: true });
        settingsProvider.handleSettingsChanged(controls);
        filterProvider.handleSettingsChanged(controls);
        graphViewProvider.handleSettingsChanged(controls);
        return controls;
    };

    const initialControls = broadcastSettings();
    if (initialControls.showStackTrace) {
        stackTraceProvider.restore(graphViewProvider);
        stackTraceProvider.update(graphViewProvider);
    }

    const providers = {
        settingsProvider,
        filterProvider,
        graphViewProvider,
        stackTraceProvider,
        analyzers: {
            [JavaAnalyzer.analyzerId]: javaAnalyzer,
            [JavaScriptAnalyzer.analyzerId]: javascriptAnalyzer
        }
    };

    const commands = registerCommands(context, providers);

    const eventHandlers = [
        configManager.onDidChange(async (controls) => {
            const nextControls = broadcastSettings(controls);
            if (nextControls.showStackTrace) {
                await stackTraceProvider.update(graphViewProvider);
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
            if (controls.showStackTrace && stackItem) {
                await stackTraceProvider.update(graphViewProvider);
            }
        }),
        vscode.debug.onDidStartDebugSession(async () => {
            const controls = broadcastSettings();
            if (controls.showStackTrace) {
                await stackTraceProvider.update(graphViewProvider);
            }
        }),
        vscode.debug.onDidTerminateDebugSession(() => {
            const controls = broadcastSettings();
            if (controls.showStackTrace) {
                graphViewProvider.update({ type: 'stackTrace', paths: [] });
            }
        })
    ];

    context.subscriptions.push(...commands, ...eventHandlers);
}

async function deactivate() {
    // Language Clientを停止
    if (javaAnalyzer) {
        await javaAnalyzer.stopLanguageClient();
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
