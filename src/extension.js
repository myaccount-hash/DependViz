const vscode = require('vscode');
const GraphViewProvider = require('./providers/GraphViewProvider');
const FilterProvider = require('./providers/FilterProvider');
const SettingsProvider = require('./providers/SettingsProvider');
const { ConfigurationManager } = require('./utils/ConfigurationManager');
const { registerCommands } = require('./commands');
const { updateStackTrace } = require('./utils/StackTrace');
const JavaAnalyzer = require('./analyzers/JavaAnalyzer');

process.env.VSCODE_DISABLE_TELEMETRY = '1';

// グローバルなLanguage Client インスタンス
let javaAnalyzer = null;

function activate(context) {
    const settingsProvider = new SettingsProvider();
    const filterProvider = new FilterProvider();
    const graphViewProvider = new GraphViewProvider(context.extensionUri);

    // Java Analyzer (Language Client) を初期化（起動はコマンド実行時にオンデマンドで行う）
    javaAnalyzer = new JavaAnalyzer(context);

    vscode.window.createTreeView('forceGraphViewer.settings', { treeDataProvider: settingsProvider });
    vscode.window.createTreeView('forceGraphViewer.filters', { treeDataProvider: filterProvider });
    vscode.window.registerWebviewViewProvider('forceGraphViewer.sidebar', graphViewProvider);

    const configManager = ConfigurationManager.getInstance();
    const broadcastSettings = (controlsOverride) => {
        const controls = controlsOverride || configManager.loadControls({ ignoreCache: true });
        settingsProvider.handleSettingsChanged(controls);
        filterProvider.handleSettingsChanged(controls);
        graphViewProvider.handleSettingsChanged(controls);
        return controls;
    };

    const initialControls = broadcastSettings();
    if (initialControls.showStackTrace) {
        updateStackTrace(graphViewProvider);
    }

    const providers = {
        settingsProvider,
        filterProvider,
        graphViewProvider,
        javaAnalyzer
    };

    const commands = registerCommands(context, providers);

    const eventHandlers = [
        configManager.onDidChange(async (controls) => {
            const nextControls = broadcastSettings(controls);
            if (nextControls.showStackTrace) {
                await updateStackTrace(graphViewProvider);
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
                await updateStackTrace(graphViewProvider);
            }
        }),
        vscode.debug.onDidStartDebugSession(async () => {
            const controls = broadcastSettings();
            if (controls.showStackTrace) {
                await updateStackTrace(graphViewProvider);
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
