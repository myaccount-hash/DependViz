const vscode = require('vscode');
const { updateStackTrace } = require('./utils/StackTrace');
const { ConfigurationManager } = require('./utils/ConfigurationManager');

function registerCommands(context, providers) {
    const { settingsProvider, graphViewProvider, javaAnalyzer } = providers;
    const configManager = ConfigurationManager.getInstance();

    const createSliceCommand = (direction) => async () => {
        const key = direction === 'forward' ? 'enableForwardSlice' : 'enableBackwardSlice';
        await configManager.updateControl(key, true);
    };

    const commands = [
        vscode.commands.registerCommand('forceGraphViewer.refresh', async () => {
            settingsProvider.refresh();
            await graphViewProvider.refresh();
        }),
        vscode.commands.registerCommand('forceGraphViewer.showSearchInput', async () => {
            const controls = configManager.loadControls({ ignoreCache: true });
            const search = await vscode.window.showInputBox({
                prompt: '検索クエリ (例: Test, name:/Test.*/, type:Class AND name:Util, path:/.*Service/ OR NOT type:Unknown)',
                value: controls.search,
                placeHolder: '検索... (name:, type:, path: フィールド指定可, /正規表現/, AND/OR/NOT 演算可)'
            });
            if (search !== undefined) {
                await configManager.updateControl('search', search);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.toggleCheckbox', async (key) => {
            const controls = configManager.loadControls({ ignoreCache: true });
            await configManager.updateControl(key, !controls[key]);
        }),
        vscode.commands.registerCommand('forceGraphViewer.showSliderInput', async (key, min, max, step, currentValue) => {
            const value = await vscode.window.showInputBox({ prompt: `${key} (${min} - ${max})`, value: currentValue.toString(), validateInput: (v) => { const num = parseFloat(v); return isNaN(num) || num < min || num > max ? `値は ${min} から ${max} の間で入力してください` : null; } });
            if (value !== undefined) {
                await configManager.updateControl(key, parseFloat(value));
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.showColorPicker', async (key, currentColor) => {
            const color = await vscode.window.showInputBox({ prompt: '色を入力 (例: #ff0000)', value: currentColor, validateInput: (v) => /^#[0-9a-fA-F]{6}$/.test(v) ? null : '有効な16進数カラーコードを入力してください (例: #ff0000)' });
            if (color !== undefined) {
                await configManager.updateControl(key, color);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeJavaProject', async () => {
            const graphData = await javaAnalyzer.analyze();
            if (graphData) {
                graphViewProvider.setGraphData(graphData);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeCurrentFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return vscode.window.showErrorMessage('アクティブなエディタがありません');
            }

            const filePath = editor.document.uri.fsPath;
            if (!filePath.endsWith('.java')) {
                return vscode.window.showErrorMessage('Javaファイルではありません');
            }

            try {
                const graphData = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'ファイルを解析中...',
                    cancellable: false
                }, () => javaAnalyzer.analyzeFile(filePath));

                // グラフデータをマージ
                graphViewProvider.mergeGraphData(graphData);
                vscode.window.showInformationMessage(`解析完了: ${graphData.nodes.length}ノード, ${graphData.links.length}リンク`);
            } catch (e) {
                vscode.window.showErrorMessage(`解析失敗: ${e.message}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.updateStackTrace', async () => {
            try {
                await updateStackTrace(graphViewProvider);
                vscode.window.showInformationMessage('スタックトレースを更新しました');
            } catch (e) {
                vscode.window.showErrorMessage(`取得失敗: ${e.message}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.forwardSlice', createSliceCommand('forward')),
        vscode.commands.registerCommand('forceGraphViewer.backwardSlice', createSliceCommand('backward')),
        vscode.commands.registerCommand('forceGraphViewer.clearSlice', async () => {
            await configManager.updateControls({ enableForwardSlice: false, enableBackwardSlice: false });
        }),
        vscode.commands.registerCommand('forceGraphViewer.toggle3DMode', async () => {
            await graphViewProvider.toggle3DMode();
        }),
        vscode.commands.registerCommand('forceGraphViewer.clearFocus', async () => {
            await graphViewProvider.clearFocus();
        }),
    ];

    return commands;
}

module.exports = { registerCommands };
