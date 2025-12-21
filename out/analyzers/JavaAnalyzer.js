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
exports.JavaAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const node_1 = require("vscode-languageclient/node");
const utils_1 = require("../utils/utils");
const BaseAnalyzer_1 = require("./BaseAnalyzer");
/**
 * JavaAnalyzer
 * Language Serverを使用してJavaプロジェクトを解析
 */
class JavaAnalyzer extends BaseAnalyzer_1.BaseAnalyzer {
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
                { type: 'ObjectCreate', defaultEnabled: true, defaultColor: '#fde047' },
                { type: 'Extends', defaultEnabled: true, defaultColor: '#ff83c5ff' },
                { type: 'Implements', defaultEnabled: true, defaultColor: '#26f9a5ff' },
                { type: 'TypeUse', defaultEnabled: true, defaultColor: '#fdba74' },
                { type: 'MethodCall', defaultEnabled: true, defaultColor: '#fda4af' }
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
            const serverOptions = {
                run: {
                    command: 'java',
                    args: baseArgs,
                    transport: node_1.TransportKind.stdio
                },
                debug: {
                    command: 'java',
                    args: baseArgs,
                    transport: node_1.TransportKind.stdio
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
            this.client = new node_1.LanguageClient('dependvizJavaAnalyzer', 'DependViz Java Analyzer', serverOptions, clientOptions);
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
        }
        catch (error) {
            const err = error;
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
            (0, utils_1.validateGraphData)(data);
            return { nodes: data.nodes, links: data.links };
        }
        catch (error) {
            console.error('Failed to get file dependency graph:', error);
            throw error;
        }
    }
    async analyzeFile(filePath) {
        return this.analyzeFileInternal(filePath, { openDocument: true });
    }
    async analyzeFileInternal(filePath, { openDocument = false } = {}) {
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
            this.getWorkspaceFolder();
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
                        const graphData = await this.analyzeFileInternal(file.fsPath);
                        (0, utils_1.mergeGraphData)(mergedGraph, graphData);
                        successCount++;
                    }
                    catch (error) {
                        console.error(`Failed to analyze file: ${file.fsPath}`, error);
                        errorCount++;
                    }
                    finally {
                        progress.report({
                            message: `(${i + 1}/${javaFiles.length})`,
                            increment
                        });
                    }
                }
            });
            vscode.window.showInformationMessage(`解析完了: ${successCount}ファイル成功, ${errorCount}ファイル失敗 (${mergedGraph.nodes.length}ノード, ${mergedGraph.links.length}リンク)`);
            return mergedGraph;
        }
        catch (error) {
            const err = error;
            vscode.window.showErrorMessage(`解析失敗: ${err.message}`);
            throw error;
        }
    }
    getWorkspaceFolder() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            throw new Error('ワークスペースが開かれていません');
        return workspaceFolder;
    }
}
exports.JavaAnalyzer = JavaAnalyzer;
exports.default = JavaAnalyzer;
//# sourceMappingURL=JavaAnalyzer.js.map