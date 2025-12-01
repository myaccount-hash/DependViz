const vscode = require('vscode');
const AppearanceSettingsProvider = require('./providers/AppearanceSettingsProvider');
const GraphViewProvider = require('./providers/GraphViewProvider');
const FilterSettingsProvider = require('./providers/FilterSettingsProvider');
const DetailSettingsProvider = require('./providers/DetailSettingsProvider');
const { ConfigurationManager } = require('./utils/ConfigurationManager');
const { registerCommands } = require('./commands');
const { updateStackTrace } = require('./commands/stackTrace');

process.env.VSCODE_DISABLE_TELEMETRY = '1';

function activate(context) {
    const appearanceSettingsProvider = new AppearanceSettingsProvider();
    const graphViewProvider = new GraphViewProvider(context.extensionUri);
    const filterSettingsProvider = new FilterSettingsProvider();
    const detailSettingsProvider = new DetailSettingsProvider();

    vscode.window.createTreeView('forceGraphViewer.tree', { treeDataProvider: filterSettingsProvider });
    vscode.window.createTreeView('forceGraphViewer.appearance', { treeDataProvider: appearanceSettingsProvider });
    vscode.window.createTreeView('forceGraphViewer.detail', { treeDataProvider: detailSettingsProvider });
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
        filterSettingsProvider,
        appearanceSettingsProvider,
        detailSettingsProvider,
        graphViewProvider
    };

    const commands = registerCommands(context, providers);

    const eventHandlers = [
        filterSettingsProvider.onDidChangeTreeData(onProviderChange),
        appearanceSettingsProvider.onDidChangeTreeData(onProviderChange),
        detailSettingsProvider.onDidChangeTreeData(onProviderChange),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('forceGraphViewer')) {
                filterSettingsProvider.refresh();
                appearanceSettingsProvider.refresh();
                detailSettingsProvider.refresh();
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor?.document.uri.scheme === 'file') {
                await graphViewProvider.update({ type: 'focusNode', filePath: editor.document.uri.fsPath });
            }
        }),
        vscode.window.onDidChangeActiveColorTheme(onProviderChange)
    ];

    context.subscriptions.push(...commands, ...eventHandlers);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
