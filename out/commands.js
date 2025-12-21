"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const ConfigurationManager_1 = require("./ConfigurationManager");
/**
 * コマンドを登録する
 */
function registerCommands(_context, providers) {
    const { settingsProvider, filterProvider, graphViewProvider, callStackProvider, analyzerManager } = providers;
    const configManager = ConfigurationManager_1.ConfigurationManager.getInstance();
    const getAnalyzerName = () => analyzerManager.getActiveAnalyzerName();
    const getAnalyzerId = () => analyzerManager.getActiveAnalyzerId();
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
        vscode.commands.registerCommand('forceGraphViewer.toggleCallStackEntry', async (sessionId) => {
            if (!sessionId)
                return;
            const controls = configManager.loadControls({ ignoreCache: true });
            const selection = Array.isArray(controls.callStackSelection) ? [...controls.callStackSelection] : [];
            const index = selection.indexOf(sessionId);
            if (index === -1) {
                selection.push(sessionId);
            }
            else {
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
        vscode.commands.registerCommand('forceGraphViewer.showSliderInput', async (key, min, max, _step, currentValue) => {
            const value = await vscode.window.showInputBox({
                prompt: `${key} (${min} - ${max})`,
                value: currentValue.toString(),
                validateInput: (v) => {
                    const num = parseFloat(v);
                    return isNaN(num) || num < min || num > max ? `値は ${min} から ${max} の間で入力してください` : null;
                }
            });
            if (value !== undefined) {
                await configManager.updateControl(key, parseFloat(value));
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeProject', async () => {
            const graphData = await analyzerManager.analyzeProject();
            if (!graphData) {
                vscode.window.showErrorMessage('有効なアナライザーが選択されていません');
                return;
            }
            if (graphData) {
                graphViewProvider.setGraphData(graphData);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeCurrentFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('アクティブなエディタがありません');
                return;
            }
            const analyzerId = getAnalyzerId();
            if (!analyzerId) {
                vscode.window.showErrorMessage('有効なアナライザーが選択されていません');
                return;
            }
            const analyzerName = getAnalyzerName();
            const filePath = editor.document.uri.fsPath;
            if (!analyzerManager.isFileSupported(filePath)) {
                vscode.window.showErrorMessage(`${analyzerName} では解析できないファイルです`);
                return;
            }
            try {
                if (analyzerId === 'java') {
                    const graphData = await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'ファイルを解析中...',
                        cancellable: false
                    }, () => analyzerManager.analyzeFile(filePath));
                    if (graphData) {
                        graphViewProvider.mergeGraphData(graphData);
                        vscode.window.showInformationMessage(`解析完了: ${graphData.nodes.length}ノード, ${graphData.links.length}リンク`);
                    }
                }
                else {
                    const graphData = await analyzerManager.analyzeFile(filePath);
                    if (graphData) {
                        graphViewProvider.mergeGraphData(graphData);
                        vscode.window.showInformationMessage(`${analyzerName} の解析完了: ${graphData.nodes.length}ノード, ${graphData.links.length}リンク`);
                    }
                }
            }
            catch (e) {
                vscode.window.showErrorMessage(`解析失敗: ${e.message}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.updateCallStack', async () => {
            try {
                await callStackProvider.update(graphViewProvider);
                vscode.window.showInformationMessage('コールスタックを更新しました');
            }
            catch (e) {
                vscode.window.showErrorMessage(`取得失敗: ${e.message}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.removeCallStackEntry', async (item) => {
            if (!item?.id) {
                return;
            }
            try {
                await callStackProvider.removeSession(item.id, graphViewProvider);
            }
            catch (e) {
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
//# sourceMappingURL=commands.js.map