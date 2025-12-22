const vscode = require('vscode');
const { ConfigurationManager } = require('./ConfigurationManager');

function registerCommands(providers) {
    const { settingsProvider, filterProvider, graphViewProvider, callStackProvider, analyzerManager } = providers;
    const configManager = ConfigurationManager.getInstance();
    const getAnalyzerName = () => analyzerManager.getActiveAnalyzerName();
    const getAnalyzerId = () => analyzerManager.getActiveAnalyzerId();
    const getControls = () => configManager.loadControls();

    const createSliceCommand = (direction) => async () => {
        const key = direction === 'forward' ? 'enableForwardSlice' : 'enableBackwardSlice';
        await configManager.updateControl(key, true);
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
                await configManager.updateControl('search', search);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.toggleCheckbox', async (key) => {
            const controls = getControls();
            await configManager.updateControl(key, !controls[key]);
        }),
        vscode.commands.registerCommand('forceGraphViewer.toggleCallStackEntry', async (sessionId) => {
            if (!sessionId) return;
            const controls = getControls();
            const selection = Array.isArray(controls.callStackSelection) ? [...controls.callStackSelection] : [];
            const index = selection.indexOf(sessionId);
            if (index === -1) {
                selection.push(sessionId);
            } else {
                selection.splice(index, 1);
            }
            await configManager.updateControl('callStackSelection', selection);
            await callStackProvider.notifySelectionChanged(graphViewProvider);
        }),
        vscode.commands.registerCommand('forceGraphViewer.selectAnalyzer', async (analyzerId) => {
            if (typeof analyzerId === 'string' && analyzerId.length > 0) {
                await configManager.updateControl('analyzerId', analyzerId);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.showSliderInput', async (key, min, max, currentValue) => {
            const value = await vscode.window.showInputBox({
                prompt: `${key} (${min} - ${max})`,
                value: currentValue.toString(),
                validateInput: (input) => {
                    const num = parseFloat(input);
                    return isNaN(num) || num < min || num > max
                        ? `値は ${min} から ${max} の間で入力してください`
                        : null;
                }
            });
            if (value !== undefined) {
                await configManager.updateControl(key, parseFloat(value));
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeProject', async () => {
            const graphData = await analyzerManager.analyzeProject();
            if (!graphData) {
                return vscode.window.showErrorMessage('有効なアナライザーが選択されていません');
            }
            graphViewProvider.setGraphData(graphData);
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeCurrentFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return vscode.window.showErrorMessage('アクティブなエディタがありません');
            }

            const analyzerId = getAnalyzerId();
            const analyzerName = getAnalyzerName();
            const filePath = editor.document.uri.fsPath;
            if (!analyzerManager.isFileSupported(filePath)) {
                return vscode.window.showErrorMessage(`${analyzerName} では解析できないファイルです`);
            }

            try {
                if (analyzerId === 'java') {
                    const graphData = await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'ファイルを解析中...',
                        cancellable: false
                    }, () => analyzerManager.analyzeFile(filePath));
                    graphViewProvider.mergeGraphData(graphData);
                    vscode.window.showInformationMessage(`解析完了: ${graphData.nodes.length}ノード, ${graphData.links.length}リンク`);
                } else {
                    const graphData = await analyzerManager.analyzeFile(filePath);
                    graphViewProvider.mergeGraphData(graphData);
                    vscode.window.showInformationMessage(`${analyzerName} の解析完了: ${graphData.nodes.length}ノード, ${graphData.links.length}リンク`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`解析失敗: ${error.message}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.updateCallStack', async () => {
            try {
                await callStackProvider.update(graphViewProvider);
                vscode.window.showInformationMessage('コールスタックを更新しました');
            } catch (error) {
                vscode.window.showErrorMessage(`取得失敗: ${error.message}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.removeCallStackEntry', async (item) => {
            if (!item?.id) {
                return;
            }
            try {
                await callStackProvider.removeSession(item.id, graphViewProvider);
            } catch (error) {
                vscode.window.showErrorMessage(`削除失敗: ${error.message}`);
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
        })
    ];

    return commands;
}

module.exports = { registerCommands };
