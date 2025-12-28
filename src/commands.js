const vscode = require('vscode');
const ConfigurationSubject = require('./configuration/ConfigurationSubject');

function registerCommands(providers) {
    const { settingsProvider, filterProvider, graphViewProvider, analyzerManager } = providers;
    const configSubject = ConfigurationSubject.getInstance();
    const getControls = () => configSubject.loadControls();

    const createSliceCommand = (direction) => async () => {
        const key = direction === 'forward' ? 'enableForwardSlice' : 'enableBackwardSlice';
        await configSubject.updateControls({ [key]: true });
    };

    const commands = [
        vscode.commands.registerCommand('forceGraphViewer.refresh', async () => {
            settingsProvider.refresh();
            filterProvider.refresh();
            graphViewProvider.syncToWebview();
        }),
        vscode.commands.registerCommand('forceGraphViewer.showSearchInput', async () => {
            const controls = getControls();
            const search = await vscode.window.showInputBox({
                prompt: '検索クエリ (例: Test, name:/Test.*/, type:Class AND name:Util, path:/.*Service/ OR NOT type:Unknown)',
                value: controls.search,
                placeHolder: '検索... (name:, type:, path: フィールド指定可, /正規表現/, AND/OR/NOT 演算可)'
            });
            if (search !== undefined) {
                await configSubject.updateControls({ search });
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.toggleCheckbox', async (key) => {
            const controls = getControls();
            await configSubject.updateControls({ [key]: !controls[key] });
        }),
        vscode.commands.registerCommand('forceGraphViewer.selectAnalyzer', async (analyzerId) => {
            if (typeof analyzerId === 'string' && analyzerId.length > 0) {
                await configSubject.updateControls({ analyzerId });
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeProject', async () => {
            const graphData = await analyzerManager.analyzeProject();
            if (!graphData) {
                return vscode.window.showErrorMessage('有効なアナライザーが選択されていません');
            }
            graphViewProvider.setGraphData(graphData);
        }),
        vscode.commands.registerCommand('forceGraphViewer.forwardSlice', createSliceCommand('forward')),
        vscode.commands.registerCommand('forceGraphViewer.backwardSlice', createSliceCommand('backward')),
        vscode.commands.registerCommand('forceGraphViewer.clearSlice', async () => {
            await configSubject.updateControls({ enableForwardSlice: false, enableBackwardSlice: false });
        }),
        vscode.commands.registerCommand('forceGraphViewer.clearFocus', async () => {
            await graphViewProvider.clearFocus();
        })
    ];

    return commands;
}

module.exports = { registerCommands };
