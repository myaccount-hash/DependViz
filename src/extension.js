const vscode = require('vscode');
const SettingsProvider = require('./providers/SettingsProvider');
const GraphViewProvider = require('./providers/GraphViewProvider');
const { ConfigurationManager } = require('./utils/ConfigurationManager');
const { registerCommands } = require('./commands');
const { updateStackTrace } = require('./utils/StackTrace');
const JavaAnalyzer = require('./analyzers/JavaAnalyzer');

process.env.VSCODE_DISABLE_TELEMETRY = '1';

// グローバルなLanguage Client インスタンス
let javaAnalyzer = null;

function activate(context) {
    const settingsProvider = new SettingsProvider();
    const graphViewProvider = new GraphViewProvider(context.extensionUri);

    // Java Analyzer (Language Client) を初期化（起動はコマンド実行時にオンデマンドで行う）
    javaAnalyzer = new JavaAnalyzer(context);

    vscode.window.createTreeView('forceGraphViewer.settings', { treeDataProvider: settingsProvider });
    vscode.window.registerWebviewViewProvider('forceGraphViewer.sidebar', graphViewProvider);

    const syncControls = () => {
        graphViewProvider.update({ type: 'controls' });
        const controls = ConfigurationManager.getInstance().loadControls();
        if (controls.showStackTrace) {
            updateStackTrace(graphViewProvider);
        }
    };

    const onProviderChange = () => syncControls();

    syncControls();

    const providers = {
        settingsProvider,
        graphViewProvider,
        javaAnalyzer
    };

    const commands = registerCommands(context, providers);

    const eventHandlers = [
        settingsProvider.onDidChangeTreeData(onProviderChange),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('forceGraphViewer')) {
                settingsProvider.refresh();
                graphViewProvider.syncToWebview();
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor?.document.uri.scheme === 'file') {
                await graphViewProvider.update({ type: 'focusNode', filePath: editor.document.uri.fsPath });
            }
        }),
        vscode.window.onDidChangeActiveColorTheme(onProviderChange),
        vscode.debug.onDidChangeActiveStackItem(async (stackItem) => {
            const controls = ConfigurationManager.getInstance().loadControls();
            if (controls.showStackTrace && stackItem) {
                await updateStackTrace(graphViewProvider);
            }
        }),
        vscode.debug.onDidStartDebugSession(async () => {
            const controls = ConfigurationManager.getInstance().loadControls();
            if (controls.showStackTrace) {
                await updateStackTrace(graphViewProvider);
            }
        }),
        vscode.debug.onDidTerminateDebugSession(() => {
            const controls = ConfigurationManager.getInstance().loadControls();
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
