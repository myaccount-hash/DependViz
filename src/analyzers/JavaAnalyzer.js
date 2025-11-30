const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { getWorkspaceFolder } = require('../utils/utils');
const javaConfig = require('../config/javaConfig');

class JavaAnalyzer {
    constructor(context) {
        this.context = context;
    }

    async analyze() {
        const jarPath = path.join(this.context.extensionPath, javaConfig.JAR_FILE);
        if (!fs.existsSync(jarPath)) {
            return vscode.window.showErrorMessage(`${javaConfig.JAR_FILE} が見つかりません`);
        }

        let workspaceFolder;
        try {
            workspaceFolder = getWorkspaceFolder();
        } catch (e) {
            return vscode.window.showErrorMessage(e.message);
        }

        const dataDir = path.join(workspaceFolder.uri.fsPath, javaConfig.DATA_DIR);
        const tempOutput = path.join(dataDir, javaConfig.TEMP_OUTPUT);
        const finalOutput = path.join(workspaceFolder.uri.fsPath, javaConfig.GRAPH_OUTPUT);

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Javaソースディレクトリを取得
        const config = vscode.workspace.getConfiguration('forceGraphViewer');
        const configuredDir = config.get('javaSourceDirectory', '');

        let sourcePath;
        if (configuredDir) {
            // 設定値が指定されている場合
            if (path.isAbsolute(configuredDir)) {
                sourcePath = configuredDir;
            } else {
                sourcePath = path.join(workspaceFolder.uri.fsPath, configuredDir);
            }
            if (!fs.existsSync(sourcePath)) {
                return vscode.window.showErrorMessage(`指定されたディレクトリが見つかりません: ${sourcePath}`);
            }
        } else {
            // デフォルト: ワークスペース全体
            sourcePath = workspaceFolder.uri.fsPath;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Javaプロジェクトを解析中...',
            cancellable: false
        }, () => new Promise((resolve, reject) => {
            const process = spawn('java', ['-jar', jarPath, sourcePath], { cwd: workspaceFolder.uri.fsPath });
            let stderr = '';
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            process.on('close', async (code) => {
                if (code !== 0) {
                    vscode.window.showErrorMessage(`解析失敗: ${stderr || 'Unknown error'}`);
                    reject();
                } else if (!fs.existsSync(tempOutput)) {
                    vscode.window.showErrorMessage('解析失敗: 出力ファイルが生成されませんでした');
                    reject();
                } else {
                    fs.renameSync(tempOutput, finalOutput);
                    vscode.window.showInformationMessage('解析完了');
                    resolve();
                }
            });
        }));
    }
}

module.exports = JavaAnalyzer;

