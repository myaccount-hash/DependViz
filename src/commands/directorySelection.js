const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { getWorkspaceFolder } = require('../utils/utils');

async function selectJavaSourceDirectory() {
    let workspaceFolder;
    try {
        workspaceFolder = getWorkspaceFolder();
    } catch (e) {
        return vscode.window.showErrorMessage(e.message);
    }

    const workspacePath = workspaceFolder.uri.fsPath;
    const config = vscode.workspace.getConfiguration('forceGraphViewer');
    const currentDir = config.get('javaSourceDirectory', '');

    const getDirectories = (dir, maxDepth = 5, currentDepth = 0) => {
        if (currentDepth >= maxDepth) return [];
        const dirs = [];

        // 除外すべきディレクトリリスト
        const excludeDirs = new Set([
            'node_modules', 'target', 'build', 'out', 'dist',
            '.git', '.svn', '.idea', '.vscode', '__pycache__'
        ]);

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() &&
                    !entry.name.startsWith('.') &&
                    !excludeDirs.has(entry.name)) {

                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(workspacePath, fullPath);
                    dirs.push({
                        label: relativePath,
                        relativePath: relativePath,
                        fullPath
                    });

                    if (currentDepth < maxDepth - 1) {
                        dirs.push(...getDirectories(fullPath, maxDepth, currentDepth + 1));
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to read directory ${dir}:`, e);
        }
        return dirs;
    };

    const directories = getDirectories(workspacePath);
    const items = [
        { label: 'ワークスペース全体', relativePath: '', description: '' },
        ...directories.map(d => ({ label: d.label, relativePath: d.relativePath, description: d.fullPath })),
        { label: 'パスを入力', relativePath: null, description: '' }
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Javaソースディレクトリを選択',
        canPickMany: false
    });

    if (!selected) return;

    let relativePath = '';
    if (selected.relativePath === null) {
        const input = await vscode.window.showInputBox({
            prompt: 'ディレクトリパスを入力（相対パスまたは絶対パス）',
            value: currentDir,
            placeHolder: '例: src/main/java または /absolute/path',
            validateInput: (value) => {
                if (!value) return null;
                const testPath = path.isAbsolute(value) ? value : path.join(workspacePath, value);
                if (!fs.existsSync(testPath)) {
                    return '指定されたディレクトリが見つかりません';
                }
                if (!fs.statSync(testPath).isDirectory()) {
                    return 'ディレクトリを指定してください';
                }
                return null;
            }
        });
        if (input === undefined) return;

        // 絶対パスの場合は相対パスに変換
        if (path.isAbsolute(input)) {
            relativePath = path.relative(workspacePath, input);
            // ワークスペース外の場合は警告
            if (relativePath.startsWith('..')) {
                const proceed = await vscode.window.showWarningMessage(
                    'ワークスペース外のディレクトリが指定されました。このまま保存しますか？',
                    'はい', 'キャンセル'
                );
                if (proceed !== 'はい') return;
                relativePath = input; // ワークスペース外なら絶対パスのまま保存
            }
        } else {
            relativePath = input;
        }
    } else {
        relativePath = selected.relativePath;
    }

    await config.update('javaSourceDirectory', relativePath, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`Javaソースディレクトリを設定しました: ${relativePath || 'ワークスペース全体'}`);
}

module.exports = { selectJavaSourceDirectory };
