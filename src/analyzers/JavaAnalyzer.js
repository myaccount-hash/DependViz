const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { getWorkspaceFolder, findJavaFiles, mergeGraphData } = require('../utils/utils');
const { JAVA_PATHS } = require('../constants');

class JavaAnalyzer {
    constructor(context) {
        this.context = context;
    }

    /**
     * 単一ファイルを解析
     * @param {string} filePath - 解析対象のJavaファイルのパス
     * @returns {Promise<Object>} - グラフデータ { nodes, links }
     */
    async analyzeFile(filePath) {
        const jarPath = path.join(this.context.extensionPath, JAVA_PATHS.JAR_FILE);
        if (!fs.existsSync(jarPath)) {
            throw new Error(`${JAVA_PATHS.JAR_FILE} が見つかりません`);
        }

        if (!fs.existsSync(filePath)) {
            throw new Error(`ファイルが見つかりません: ${filePath}`);
        }

        let workspaceFolder;
        try {
            workspaceFolder = getWorkspaceFolder();
        } catch (e) {
            throw new Error(e.message);
        }

        const dataDir = path.join(workspaceFolder.uri.fsPath, JAVA_PATHS.DATA_DIR);
        const tempOutput = path.join(dataDir, JAVA_PATHS.TEMP_OUTPUT);

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const process = spawn('java', ['-jar', jarPath, '--file', filePath], {
                cwd: workspaceFolder.uri.fsPath
            });
            let stderr = '';

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('error', (error) => {
                reject(new Error(`Java実行エラー: ${error.message}`));
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`解析失敗 (終了コード: ${code}): ${stderr || 'Unknown error'}`));
                } else if (!fs.existsSync(tempOutput)) {
                    reject(new Error('解析失敗: 出力ファイルが生成されませんでした'));
                } else {
                    try {
                        const data = JSON.parse(fs.readFileSync(tempOutput, 'utf8'));
                        fs.unlinkSync(tempOutput); // 一時ファイルを削除
                        resolve(data);
                    } catch (e) {
                        reject(new Error(`JSON読み込みエラー: ${e.message}`));
                    }
                }
            });
        });
    }

    /**
     * ディレクトリ内の全Javaファイルを解析
     * JavaScript側で各ファイルを解析してグラフを構築
     */
    async analyze() {
        let workspaceFolder;
        try {
            workspaceFolder = getWorkspaceFolder();
        } catch (e) {
            return vscode.window.showErrorMessage(e.message);
        }

        // Javaソースディレクトリを取得
        const config = vscode.workspace.getConfiguration('forceGraphViewer');
        const configuredDir = config.get('javaSourceDirectory', '');

        let sourcePath;
        if (configuredDir) {
            if (path.isAbsolute(configuredDir)) {
                sourcePath = configuredDir;
            } else {
                sourcePath = path.join(workspaceFolder.uri.fsPath, configuredDir);
            }
            if (!fs.existsSync(sourcePath)) {
                return vscode.window.showErrorMessage(`指定されたディレクトリが見つかりません: ${sourcePath}`);
            }
        } else {
            sourcePath = workspaceFolder.uri.fsPath;
        }

        // ディレクトリ内の全Javaファイルを探索
        const javaFiles = findJavaFiles(sourcePath);

        if (javaFiles.length === 0) {
            return vscode.window.showWarningMessage('Javaファイルが見つかりませんでした');
        }

        // 全ファイルを解析してマージ
        const mergedGraph = { nodes: [], links: [] };
        let successCount = 0;
        let errorCount = 0;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Javaプロジェクトを解析中 (0/${javaFiles.length})...`,
            cancellable: false
        }, async (progress) => {
            for (let i = 0; i < javaFiles.length; i++) {
                const filePath = javaFiles[i];
                try {
                    const graphData = await this.analyzeFile(filePath);
                    console.log(`[${i + 1}/${javaFiles.length}] ${filePath}: ${graphData.nodes.length} nodes, ${graphData.links.length} links`);

                    const beforeNodes = mergedGraph.nodes.length;
                    const beforeLinks = mergedGraph.links.length;

                    mergeGraphData(mergedGraph, graphData);

                    const addedNodes = mergedGraph.nodes.length - beforeNodes;
                    const addedLinks = mergedGraph.links.length - beforeLinks;
                    console.log(`  Merged: +${addedNodes} nodes (${beforeNodes} -> ${mergedGraph.nodes.length}), +${addedLinks} links (${beforeLinks} -> ${mergedGraph.links.length})`);

                    successCount++;
                } catch (e) {
                    console.error(`Failed to analyze ${filePath}:`, e);
                    errorCount++;
                }
                progress.report({
                    message: `(${i + 1}/${javaFiles.length})`,
                    increment: (100 / javaFiles.length)
                });
            }
        });

        // 結果を保存
        const finalOutput = path.join(workspaceFolder.uri.fsPath, JAVA_PATHS.GRAPH_OUTPUT);
        try {
            fs.writeFileSync(finalOutput, JSON.stringify(mergedGraph, null, 2));
            vscode.window.showInformationMessage(
                `解析完了: ${successCount}ファイル成功, ${errorCount}ファイル失敗 (${mergedGraph.nodes.length}ノード, ${mergedGraph.links.length}リンク)`
            );
        } catch (e) {
            vscode.window.showErrorMessage(`結果の保存に失敗: ${e.message}`);
        }
    }

}

module.exports = JavaAnalyzer;

