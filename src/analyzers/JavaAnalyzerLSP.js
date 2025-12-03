const vscode = require('vscode');
const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');
const { getWorkspaceFolder } = require('../utils/utils');

/**
 * JavaAnalyzer - LSP版
 * Language Serverを使用してJavaプロジェクトを解析
 */
class JavaAnalyzerLSP {
    constructor(context) {
        this.context = context;
        this.client = null;
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

        try {
            const workspaceFolder = getWorkspaceFolder();
            const jarPath = path.join(this.context.extensionPath, 'java-graph.jar');

            // サーバーオプション
            const serverOptions = {
                run: {
                    command: 'java',
                    args: [
                        '-Djava.util.logging.config.file=' + path.join(this.context.extensionPath, 'logging.properties'),
                        '-jar',
                        jarPath
                    ],
                    transport: TransportKind.stdio,
                    options: {
                        stdio: 'pipe'
                    }
                },
                debug: {
                    command: 'java',
                    args: [
                        '-Djava.util.logging.config.file=' + path.join(this.context.extensionPath, 'logging.properties'),
                        '-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005',
                        '-jar',
                        jarPath
                    ],
                    transport: TransportKind.stdio,
                    options: {
                        stdio: 'pipe'
                    }
                }
            };

            // Output Channelを作成
            const outputChannel = vscode.window.createOutputChannel('DependViz Java Language Server');

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

            // 初期化完了を待つ
            await this.client.onReady();
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
     * プロジェクト全体の依存関係グラフを取得
     */
    async getDependencyGraph() {
        if (!this.client) {
            await this.startLanguageClient();
        }

        try {
            const result = await this.client.sendRequest('dependviz/getDependencyGraph');
            return JSON.parse(result);
        } catch (error) {
            console.error('Failed to get dependency graph:', error);
            throw error;
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
            return JSON.parse(result);
        } catch (error) {
            console.error('Failed to get file dependency graph:', error);
            throw error;
        }
    }

    /**
     * 単一ファイルを解析（互換性のため）
     */
    async analyzeFile(filePath) {
        const fileUri = vscode.Uri.file(filePath).toString();

        // ファイルを開いてLanguage Serverに解析させる
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });

        // グラフデータを取得
        return await this.getFileDependencyGraph(fileUri);
    }

    /**
     * プロジェクト全体を解析（既存APIとの互換性のため）
     */
    async analyze() {
        try {
            // Language Clientを起動
            await this.startLanguageClient();

            // すべてのJavaファイルを開いてLanguage Serverに解析させる
            const workspaceFolder = getWorkspaceFolder();
            const javaFiles = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**');

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Javaプロジェクトを解析中 (0/${javaFiles.length})...`,
                cancellable: false
            }, async (progress) => {
                for (let i = 0; i < javaFiles.length; i++) {
                    const file = javaFiles[i];
                    try {
                        // ファイルを開く（Language Serverが自動的に解析）
                        const document = await vscode.workspace.openTextDocument(file);
                        await vscode.languages.setTextDocumentLanguage(document, 'java');

                        progress.report({
                            message: `(${i + 1}/${javaFiles.length})`,
                            increment: (100 / javaFiles.length)
                        });
                    } catch (error) {
                        console.error(`Failed to open file: ${file.fsPath}`, error);
                    }
                }
            });

            // 全体のグラフデータを取得
            const graphData = await this.getDependencyGraph();

            vscode.window.showInformationMessage(
                `解析完了: ${javaFiles.length}ファイル (${graphData.nodes.length}ノード, ${graphData.links.length}リンク)`
            );

            return graphData;

        } catch (error) {
            vscode.window.showErrorMessage(`解析失敗: ${error.message}`);
            throw error;
        }
    }
}

module.exports = JavaAnalyzerLSP;
