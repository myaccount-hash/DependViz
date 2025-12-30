const vscode = require('vscode');

function registerCommands(providers) {
    const { settingsProvider, filterProvider, graphViewProvider, analyzerManager } = providers;
    const getAnalyzerName = () => analyzerManager.getActiveAnalyzerName();
    const getAnalyzerId = () => analyzerManager.getActiveAnalyzerId();

    const commands = [
        vscode.commands.registerCommand('forceGraphViewer.refresh', async () => {
            settingsProvider.refresh();
            filterProvider.refresh();
            graphViewProvider.syncToWebview();
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
        })
    ];

    return commands;
}

module.exports = { registerCommands };
