const vscode = require('vscode');
const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');
const { getWorkspaceFolder, mergeGraphData } = require('../utils/utils');
const { normalizeAnalyzerResponse } = require('../messaging/AnalyzerProtocol');

/**
 * JavaAnalyzer - LSP版
 * Language Serverを使用してJavaプロジェクトを解析
 */
class JavaAnalyzer {
    constructor(context) {
        this.context = context;
        this.client = null;
        this.outputChannel = null;
    }

    /**
     * Language Clientを起動
     */
    async startLanguageClient() {
        if (this.client) {
            // 既に存在する場合、準備完了を待つ
            if (this.client.needsStart()) {
                await this.client.start();
            }
            return;
        }

        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('DependViz Java Language Server');
        }
        const outputChannel = this.outputChannel;

        try {
            const workspaceFolder = getWorkspaceFolder();
            const jarPath = path.join(this.context.extensionPath, 'java-graph.jar');
            const loggingConfig = path.join(this.context.extensionPath, 'logging.properties');
            const baseArgs = [
                `-Djava.util.logging.config.file=${loggingConfig}`,
                '-jar',
                jarPath
            ];

            // サーバーオプション（debug時もstdoutを汚さないようrunと同一設定）
            const serverOptions = {
                run: {
                    command: 'java',
                    args: baseArgs,
                    transport: TransportKind.stdio,
                    options: { stdio: 'pipe' }
                },
                debug: {
                    command: 'java',
                    args: baseArgs,
                    transport: TransportKind.stdio,
                    options: { stdio: 'pipe' }
                }
            };

            // クライアントオプション
            const clientOptions = {
                documentSelector: [{ scheme: 'file', language: 'java' }],
                synchronize: {
                    fileEvents: vscode.workspace.createFileSystemWatcher('**/*.java')
                },
                workspaceFolder: workspaceFolder,
                outputChannel: outputChannel,
                traceOutputChannel: outputChannel,
                revealOutputChannelOn: 4 // Never
            };

            // Language Clientを作成
            this.client = new LanguageClient(
                'dependvizJavaAnalyzer',
                'DependViz Java Analyzer',
                serverOptions,
                clientOptions
            );

            // エラーハンドラを設定
            this.client.onDidChangeState((event) => {
                console.log(`Language Server state changed: ${event.oldState} -> ${event.newState}`);
                outputChannel.appendLine(`State: ${event.oldState} -> ${event.newState}`);
            });

            this.client.onNotification('window/logMessage', (params) => {
                outputChannel.appendLine(`[Server Log] ${params.message}`);
            });

            // クライアントを起動して初期化を待つ
            console.log('Starting Language Server...');
            outputChannel.appendLine('Starting Language Server...');
            outputChannel.appendLine(`JAR path: ${jarPath}`);

            await this.client.start();
            console.log('Java Language Server started and ready');
            outputChannel.appendLine('Language Server is ready');
        } catch (error) {
            const errorMsg = `Failed to start Language Server: ${error.message}\nStack: ${error.stack}`;
            console.error(errorMsg);
            outputChannel.appendLine(errorMsg);
            outputChannel.show();
            this.client = null;
            throw error;
        }
    }

    /**
     * Language Clientを停止
     */
    async stopLanguageClient() {
        if (this.client) {
            await this.client.stop();
            this.client = null;
            console.log('Java Language Server stopped');
        }
    }

    /**
     * 単一ファイルの依存関係グラフを取得
     */
    async getFileDependencyGraph(fileUri) {
        if (!this.client) {
            await this.startLanguageClient();
        }

        try {
            const result = await this.client.sendRequest('dependviz/getFileDependencyGraph', fileUri);
            return normalizeAnalyzerResponse(result);
        } catch (error) {
            console.error('Failed to get file dependency graph:', error);
            throw error;
        }
    }

    async analyzeFile(filePath) {
        return this._analyzeFileInternal(filePath, { openDocument: true });
    }

    async _analyzeFileInternal(filePath, { openDocument = false } = {}) {
        const fileUri = vscode.Uri.file(filePath).toString();

        if (openDocument) {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
        }

        return this.getFileDependencyGraph(fileUri);
    }

    /**
     * プロジェクト全体を解析（既存APIとの互換性のため）
     */
    async analyze() {
        try {
            // Language Clientを起動
            await this.startLanguageClient();

            getWorkspaceFolder();
            const javaFiles = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**');

            if (javaFiles.length === 0) {
                vscode.window.showWarningMessage('Javaファイルが見つかりませんでした');
                return { nodes: [], links: [] };
            }

            const mergedGraph = { nodes: [], links: [] };
            let successCount = 0;
            let errorCount = 0;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Javaプロジェクトを解析中 (0/${javaFiles.length})...`,
                cancellable: false
            }, async (progress) => {
                const increment = 100 / javaFiles.length;
                for (let i = 0; i < javaFiles.length; i++) {
                    const file = javaFiles[i];
                    try {
                        const graphData = await this._analyzeFileInternal(file.fsPath);
                        mergeGraphData(mergedGraph, graphData);
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to analyze file: ${file.fsPath}`, error);
                        errorCount++;
                    } finally {
                        progress.report({
                            message: `(${i + 1}/${javaFiles.length})`,
                            increment
                        });
                    }
                }
            });

            vscode.window.showInformationMessage(
                `解析完了: ${successCount}ファイル成功, ${errorCount}ファイル失敗 (${mergedGraph.nodes.length}ノード, ${mergedGraph.links.length}リンク)`
            );

            return mergedGraph;

        } catch (error) {
            vscode.window.showErrorMessage(`解析失敗: ${error.message}`);
            throw error;
        }
    }
}

module.exports = JavaAnalyzer;
