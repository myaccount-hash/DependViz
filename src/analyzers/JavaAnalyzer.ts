import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { mergeGraphData, validateGraphData, GraphData } from '../utils/utils';
import { BaseAnalyzer, TypeDefinitions } from './BaseAnalyzer';

/**
 * JavaAnalyzer
 * Language Serverを使用してJavaプロジェクトを解析
 */
export class JavaAnalyzer extends BaseAnalyzer {
    private context: vscode.ExtensionContext;
    private client: LanguageClient | null;
    private outputChannel: vscode.OutputChannel | null;

    static get analyzerId(): string {
        return 'java';
    }

    static get displayName(): string {
        return 'JavaParser(Java)';
    }

    static getTypeDefinitions(): TypeDefinitions {
        return {
            node: [
                { type: 'Class', defaultEnabled: true, defaultColor: '#157df4ff' },
                { type: 'AbstractClass', defaultEnabled: true, defaultColor: '#f03e9dff' },
                { type: 'Interface', defaultEnabled: true, defaultColor: '#26f9a5ff' },
                { type: 'Unknown', defaultEnabled: false, defaultColor: '#9ca3af' }
            ],
            edge: [
                { type: 'ObjectCreate', defaultEnabled: true, defaultColor: '#fde047' },
                { type: 'Extends', defaultEnabled: true, defaultColor: '#ff83c5ff' },
                { type: 'Implements', defaultEnabled: true, defaultColor: '#26f9a5ff' },
                { type: 'TypeUse', defaultEnabled: true, defaultColor: '#fdba74' },
                { type: 'MethodCall', defaultEnabled: true, defaultColor: '#fda4af' }
            ]
        };
    }

    constructor(context: vscode.ExtensionContext) {
        super();
        this.context = context;
        this.client = null;
        this.outputChannel = null;
    }

    isFileSupported(filePath: string): boolean {
        return typeof filePath === 'string' && filePath.endsWith('.java');
    }

    /**
     * Language Clientを起動
     */
    private async startLanguageClient(): Promise<void> {
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
            const workspaceFolder = this.getWorkspaceFolder();
            const jarPath = path.join(this.context.extensionPath, 'java', 'target', 'java-graph.jar');
            const loggingConfig = path.join(this.context.extensionPath, 'logging.properties');
            const baseArgs = [
                `-Djava.util.logging.config.file=${loggingConfig}`,
                '-jar',
                jarPath
            ];

            // サーバーオプション（debug時もstdoutを汚さないようrunと同一設定）
            const serverOptions: ServerOptions = {
                run: {
                    command: 'java',
                    args: baseArgs,
                    transport: TransportKind.stdio
                },
                debug: {
                    command: 'java',
                    args: baseArgs,
                    transport: TransportKind.stdio
                }
            };

            // クライアントオプション
            const clientOptions: LanguageClientOptions = {
                documentSelector: [{ scheme: 'file', language: 'java' }],
                synchronize: {
                    fileEvents: vscode.workspace.createFileSystemWatcher('**/*.java')
                },
                workspaceFolder: workspaceFolder,
                outputChannel: outputChannel,
                traceOutputChannel: outputChannel,
                revealOutputChannelOn: 4 as any // Never
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

            this.client.onNotification('window/logMessage', (params: { message: string }) => {
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
            const err = error as Error;
            const errorMsg = `Failed to start Language Server: ${err.message}\nStack: ${err.stack}`;
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
    private async stopLanguageClient(): Promise<void> {
        if (this.client) {
            await this.client.stop();
            this.client = null;
            console.log('Java Language Server stopped');
        }
    }

    async stop(): Promise<void> {
        await this.stopLanguageClient();
    }

    /**
     * 単一ファイルの依存関係グラフを取得
     */
    private async getFileDependencyGraph(fileUri: string): Promise<GraphData> {
        if (!this.client) {
            await this.startLanguageClient();
        }

        try {
            const result = await this.client!.sendRequest('dependviz/getFileDependencyGraph', fileUri);
            let data: any = result;
            if (typeof result === 'string') {
                data = JSON.parse(result);
            }
            if (!data || typeof data !== 'object') {
                throw new Error('Analyzer response must be an object');
            }
            validateGraphData(data);
            return { nodes: data.nodes, links: data.links };
        } catch (error) {
            console.error('Failed to get file dependency graph:', error);
            throw error;
        }
    }

    async analyzeFile(filePath: string): Promise<GraphData> {
        return this.analyzeFileInternal(filePath, { openDocument: true });
    }

    private async analyzeFileInternal(filePath: string, { openDocument = false } = {}): Promise<GraphData> {
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
    async analyze(): Promise<GraphData> {
        try {
            // Language Clientを起動
            await this.startLanguageClient();

            this.getWorkspaceFolder();
            const javaFiles = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**');

            if (javaFiles.length === 0) {
                vscode.window.showWarningMessage('Javaファイルが見つかりませんでした');
                return { nodes: [], links: [] };
            }

            const mergedGraph: GraphData = { nodes: [], links: [] };
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
                        const graphData = await this.analyzeFileInternal(file.fsPath);
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
            const err = error as Error;
            vscode.window.showErrorMessage(`解析失敗: ${err.message}`);
            throw error;
        }
    }

    private getWorkspaceFolder(): vscode.WorkspaceFolder {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) throw new Error('ワークスペースが開かれていません');
        return workspaceFolder;
    }
}

export default JavaAnalyzer;
