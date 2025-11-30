const vscode = require('vscode');
const path = require('path');
const AppearanceSettingsProvider = require('./providers/AppearanceSettingsProvider');
const GraphViewProvider = require('./providers/GraphViewProvider');
const FilterSettingsProvider = require('./providers/FilterSettingsProvider');
const DetailSettingsProvider = require('./providers/DetailSettingsProvider');
const JavaAnalyzer = require('./analyzers/JavaAnalyzer');
const { loadControls } = require('./utils/utils');

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
    };

    const updateStackTrace = async () => {
        try {
            const sessions = await getAllSessions();
            if (sessions.length > 0 && sessions[0].captured) {
                const paths = sessions[0].frames.map(f => f.source?.path).filter(p => p);
                graphViewProvider.update({ type: 'stackTrace', paths });
            }
        } catch (e) {
            console.error('Failed to get stack trace:', e);
        }
    };

    // Provider → Extension: 通知（統一インターフェース）
    filterSettingsProvider.onDidChange(() => {
        syncControls();
        const controls = loadControls();
        if (controls.showStackTrace) {
            updateStackTrace();
        }
    });
    appearanceSettingsProvider.onDidChange(() => syncControls());
    detailSettingsProvider.onDidChange(() => syncControls());

    syncControls();

    const getProviderForControl = (key) => {
        if (filterSettingsProvider.controls.hasOwnProperty(key)) return filterSettingsProvider;
        if (appearanceSettingsProvider.controls.hasOwnProperty(key)) return appearanceSettingsProvider;
        return detailSettingsProvider;
    };

    const createSliceCommand = (direction) => async () => {
        const key = direction === 'forward' ? 'enableForwardSlice' : 'enableBackwardSlice';
        appearanceSettingsProvider.update({ key, value: true });
    };

    const commands = [
        vscode.commands.registerCommand('forceGraphViewer.refresh', async () => {
            filterSettingsProvider.update();
            appearanceSettingsProvider.update();
            detailSettingsProvider.update();
            await graphViewProvider.refresh();
        }),
        vscode.commands.registerCommand('forceGraphViewer.showSearchInput', async () => {
            const search = await vscode.window.showInputBox({ prompt: 'ノード名で検索', value: filterSettingsProvider.controls.search, placeHolder: '検索...' });
            if (search !== undefined) {
                filterSettingsProvider.update({ key: 'search', value: search });
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.toggleCheckbox', async (key) => {
            const provider = getProviderForControl(key);
            provider.update({ key, value: !provider.controls[key] });
        }),
        vscode.commands.registerCommand('forceGraphViewer.showSliderInput', async (key, min, max, step, currentValue) => {
            const value = await vscode.window.showInputBox({ prompt: `${key} (${min} - ${max})`, value: currentValue.toString(), validateInput: (v) => { const num = parseFloat(v); return isNaN(num) || num < min || num > max ? `値は ${min} から ${max} の間で入力してください` : null; } });
            if (value !== undefined) {
                const provider = getProviderForControl(key);
                provider.update({ key, value: parseFloat(value) });
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.showColorPicker', async (key, currentColor) => {
            const color = await vscode.window.showInputBox({ prompt: '色を入力 (例: #ff0000)', value: currentColor, validateInput: (v) => /^#[0-9a-fA-F]{6}$/.test(v) ? null : '有効な16進数カラーコードを入力してください (例: #ff0000)' });
            if (color !== undefined) {
                detailSettingsProvider.update({ key, value: color });
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.analyzeJavaProject', async () => {
            const analyzer = new JavaAnalyzer(context);
            await analyzer.analyze();
        }),
        vscode.commands.registerCommand('forceGraphViewer.selectJavaSourceDirectory', async () => {
            const { getWorkspaceFolder } = require('./utils/utils');
            let workspaceFolder;
            try {
                workspaceFolder = getWorkspaceFolder();
            } catch (e) {
                return vscode.window.showErrorMessage(e.message);
            }

            const selected = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: '選択',
                defaultUri: workspaceFolder.uri
            });

            if (selected && selected[0]) {
                const selectedPath = selected[0].fsPath;
                const workspacePath = workspaceFolder.uri.fsPath;
                
                // ワークスペースルートからの相対パスに変換
                let relativePath = '';
                if (selectedPath.startsWith(workspacePath)) {
                    relativePath = path.relative(workspacePath, selectedPath);
                    if (relativePath === '') {
                        relativePath = '';
                    }
                } else {
                    // ワークスペース外の場合は絶対パス
                    relativePath = selectedPath;
                }

                const config = vscode.workspace.getConfiguration('forceGraphViewer');
                await config.update('javaSourceDirectory', relativePath, vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage(`Javaソースディレクトリを設定しました: ${relativePath || 'ワークスペース全体'}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.updateStackTrace', async () => {
            try {
                await updateStackTrace();
                vscode.window.showInformationMessage('スタックトレースを更新しました');
            } catch (e) {
                vscode.window.showErrorMessage(`取得失敗: ${e.message}`);
            }
        }),
        vscode.commands.registerCommand('forceGraphViewer.forwardSlice', createSliceCommand('forward')),
        vscode.commands.registerCommand('forceGraphViewer.backwardSlice', createSliceCommand('backward')),
        vscode.commands.registerCommand('forceGraphViewer.clearSlice', () => {
            appearanceSettingsProvider.update({ key: 'enableForwardSlice', value: false });
            appearanceSettingsProvider.update({ key: 'enableBackwardSlice', value: false });
        }),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('forceGraphViewer')) {
                filterSettingsProvider.update();
                appearanceSettingsProvider.update();
                detailSettingsProvider.update();
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor?.document.uri.scheme === 'file') {
                await graphViewProvider.update({ type: 'focusNode', filePath: editor.document.uri.fsPath });
            }
        })
    ];

    context.subscriptions.push(...commands);
}

async function getAllSessions() {
    const sessions = vscode.debug.activeDebugSession ? [vscode.debug.activeDebugSession] : [];
    const sessionInfos = [];
    for (const session of sessions) {
        const threadsResponse = await session.customRequest('threads');
        const threads = threadsResponse.threads;

        let totalFrames = 0;
        let captured = false;
        let allFrames = [];

        if (vscode.debug.activeStackItem) {
            for (const thread of threads) {
                const stackResponse = await session.customRequest('stackTrace', { threadId: thread.id, levels: 50 });
                totalFrames += stackResponse.stackFrames.length;
                allFrames.push(...stackResponse.stackFrames);
            }
            captured = totalFrames > 0;
        }

        sessionInfos.push({
            sessionId: session.id,
            sessionName: session.name,
            sessionType: session.type,
            threadCount: threads.length,
            totalFrames,
            captured,
            frames: allFrames
        });
    }
    return sessionInfos;
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
