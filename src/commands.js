const vscode = require('vscode');
const { ConfigurationManager } = require('./utils/ConfigurationManager');
const { getDefaultAnalyzerId } = require('./analyzers');

/**
 * @param {*} context 
 * @param {*} providers 
 * @returns 
 */
function registerCommands(context, providers) {
    const { settingsProvider, filterProvider, graphViewProvider, stackTraceProvider, analyzers } = providers;
    const configManager = ConfigurationManager.getInstance();
    const getActiveAnalyzer = () => {
        const controls = configManager.loadControls();
        const analyzerId = controls.analyzerId || getDefaultAnalyzerId();
        return analyzers?.[analyzerId] || analyzers?.[getDefaultAnalyzerId()];
    };
    const getAnalyzerName = (analyzer) => analyzer?.constructor?.displayName || analyzer?.constructor?.name || 'Analyzer';

    const createSliceCommand = (direction) => async () => {
        const key = direction === 'forward' ? 'enableForwardSlice' : 'enableBackwardSlice';
        await configManager.updateControl(key, true);
    };

    const commands = [
        vscode.commands.registerCommand('forceGraphViewer.refresh', async () => {
            settingsProvider.refresh();
            filterProvider.refresh();
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
        vscode.commands.registerCommand('forceGraphViewer.selectAnalyzer', async (analyzerId) => {
            if (typeof analyzerId === 'string' && analyzerId.length > 0) {
                await configManager.updateControl('analyzerId', analyzerId);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.showSliderInput', async (key, min, max, step, currentValue) => {
            const value = await vscode.window.showInputBox({ prompt: `${key} (${min} - ${max})`, value: currentValue.toString(), validateInput: (v) => { const num = parseFloat(v); return isNaN(num) || num < min || num > max ? `値は ${min} から ${max} の間で入力してください` : null; } });
            if (value !== undefined) {
                await configManager.updateControl(key, parseFloat(value));
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeProject', async () => {
            const analyzer = getActiveAnalyzer();
            if (!analyzer || typeof analyzer.analyze !== 'function') {
                return vscode.window.showErrorMessage('有効なアナライザーが選択されていません');
            }
            const graphData = await analyzer.analyze();
            if (graphData) {
                graphViewProvider.setGraphData(graphData);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeCurrentFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return vscode.window.showErrorMessage('アクティブなエディタがありません');
            }

            const analyzer = getActiveAnalyzer();
            if (!analyzer || typeof analyzer.analyzeFile !== 'function') {
                return vscode.window.showErrorMessage('有効なアナライザーが選択されていません');
            }
            const analyzerName = getAnalyzerName(analyzer);
            const filePath = editor.document.uri.fsPath;
            if (typeof analyzer.isFileSupported === 'function' && !analyzer.isFileSupported(filePath)) {
                return vscode.window.showErrorMessage(`${analyzerName} では解析できないファイルです`);
            }

            try {
                if (analyzer.analyzerId === 'java') {
                    const graphData = await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'ファイルを解析中...',
                        cancellable: false
                    }, () => analyzer.analyzeFile(filePath));
                    graphViewProvider.mergeGraphData(graphData);
                    vscode.window.showInformationMessage(`解析完了: ${graphData.nodes.length}ノード, ${graphData.links.length}リンク`);
                } else {
                    const graphData = await analyzer.analyzeFile(filePath);
                    graphViewProvider.mergeGraphData(graphData);
                    vscode.window.showInformationMessage(`${analyzerName} の解析完了: ${graphData.nodes.length}ノード, ${graphData.links.length}リンク`);
                }
            } catch (e) {
                vscode.window.showErrorMessage(`解析失敗: ${e.message}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.updateStackTrace', async () => {
            try {
                await stackTraceProvider.update(graphViewProvider);
                vscode.window.showInformationMessage('スタックトレースを更新しました');
            } catch (e) {
                vscode.window.showErrorMessage(`取得失敗: ${e.message}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.removeStackTraceEntry', async (item) => {
            if (!item?.id) {
                return;
            }
            try {
                await stackTraceProvider.removeSession(item.id, graphViewProvider);
            } catch (e) {
                vscode.window.showErrorMessage(`削除失敗: ${e.message}`);
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
