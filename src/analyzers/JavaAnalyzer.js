const vscode = require('vscode');
const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');
const { mergeGraphData, validateGraphData } = require('../utils/graph');
const BaseAnalyzer = require('./BaseAnalyzer');

/**
 * JavaAnalyzer
 * Language Serverを使用してJavaプロジェクトを解析
 */
class JavaAnalyzer extends BaseAnalyzer {
    static get analyzerId() {
        return 'java';
    }

    static get displayName() {
        return 'JavaParser(Java)';
    }

    static getTypeDefinitions() {
        return {
            node: [
                { type: 'Class', defaultEnabled: true, defaultColor: '#157df4ff' },
                { type: 'AbstractClass', defaultEnabled: true, defaultColor: '#f03e9dff' },
                { type: 'Interface', defaultEnabled: true, defaultColor: '#26f9a5ff' },
                { type: 'Unknown', defaultEnabled: false, defaultColor: '#9ca3af' }
            ],
            edge: [
                { type: 'ObjectCreate', defaultEnabled: true, defaultColor: '#ffd500ff' },
                { type: 'Extends', defaultEnabled: true, defaultColor: '#ff83c5ff' },
                { type: 'Implements', defaultEnabled: true, defaultColor: '#26f9a5ff' },
                { type: 'TypeUse', defaultEnabled: true, defaultColor: '#ffd500ff' },
                { type: 'MethodCall', defaultEnabled: true, defaultColor: '#ffd500ff' }
            ]
        };
    }

    constructor(context) {
        super();
        this.context = context;
        this.client = null;
        this.outputChannel = null;
    }

    isFileSupported(filePath) {
        return typeof filePath === 'string' && filePath.endsWith('.java');
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
        try {
            const workspaceFolder = this._getWorkspaceFolder();
            const jarPath = path.join(this.context.extensionPath, 'java', 'target', 'java-graph.jar');
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
                outputChannel: this.outputChannel,
                traceOutputChannel: this.outputChannel,
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
                this.outputChannel.appendLine(`State: ${event.oldState} -> ${event.newState}`);
            });

            this.client.onNotification('window/logMessage', (params) => {
                const type = typeof params.type === 'number' ? params.type : 4;
                const label = type === 1 ? 'Error' : type === 2 ? 'Warn' : 'Log';
                this.outputChannel.appendLine(`[Server ${label}] ${params.message}`);
                if (type === 1) {
                    this.outputChannel.show(true);
                }
            });

            // クライアントを起動して初期化を待つ
            console.log('Starting Language Server...');
            this.outputChannel.appendLine('Starting Language Server...');
            this.outputChannel.appendLine(`JAR path: ${jarPath}`);

            await this.client.start();
            console.log('Java Language Server started and ready');
            this.outputChannel.appendLine('Language Server is ready');
        } catch (error) {
            const errorMsg = `Failed to start Language Server: ${error.message}\nStack: ${error.stack}`;
            console.error(errorMsg);
            this.outputChannel.appendLine(errorMsg);
            this.outputChannel.show();
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

    async stop() {
        await this.stopLanguageClient();
    }

    /**
     * ワークスペースフォルダーを取得
     * @returns {vscode.WorkspaceFolder} ワークスペースフォルダー
     * @throws {Error} ワークスペースが開かれていない場合
     * @private
     */
    _getWorkspaceFolder() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) throw new Error('ワークスペースが開かれていません');
        return workspaceFolder;
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
            let data = result;
            if (typeof result === 'string') {
                data = JSON.parse(result);
            }
            if (!data || typeof data !== 'object') {
                throw new Error('Analyzer response must be an object');
            }
            validateGraphData(data);
            return { nodes: data.nodes, links: data.links };
        } catch (error) {
            const message = `Failed to get file dependency graph: ${error.message}`;
            console.error(message, error);
            if (this.outputChannel) {
                this.outputChannel.appendLine(message);
                if (error.stack) {
                    this.outputChannel.appendLine(error.stack);
                }
            }
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
     * プロジェクト全体を解析
     */
    async analyze() {
        try {
            // Language Clientを起動
            await this.startLanguageClient();

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
                        const message = `Failed to analyze file: ${file.fsPath}: ${error.message}`;
                        console.error(message, error);
                        if (this.outputChannel) {
                            this.outputChannel.appendLine(message);
                            if (error.stack) {
                                this.outputChannel.appendLine(error.stack);
                            }
                        }
                        errorCount++;
                    } finally {
                        progress.report({
                            message: `(${i + 1}/${javaFiles.length})`,
                            increment
                        });
                    }
                }
            });
            // TODO: 現在エラー検知が甘い
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
