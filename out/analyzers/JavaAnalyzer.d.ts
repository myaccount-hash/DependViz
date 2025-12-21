import * as vscode from 'vscode';
import { GraphData } from '../utils/utils';
import { BaseAnalyzer, TypeDefinitions } from './BaseAnalyzer';
/**
 * JavaAnalyzer
 * Language Serverを使用してJavaプロジェクトを解析
 */
export declare class JavaAnalyzer extends BaseAnalyzer {
    private context;
    private client;
    private outputChannel;
    static get analyzerId(): string;
    static get displayName(): string;
    static getTypeDefinitions(): TypeDefinitions;
    constructor(context: vscode.ExtensionContext);
    isFileSupported(filePath: string): boolean;
    /**
     * Language Clientを起動
     */
    private startLanguageClient;
    /**
     * Language Clientを停止
     */
    private stopLanguageClient;
    stop(): Promise<void>;
    /**
     * 単一ファイルの依存関係グラフを取得
     */
    private getFileDependencyGraph;
    analyzeFile(filePath: string): Promise<GraphData>;
    private analyzeFileInternal;
    /**
     * プロジェクト全体を解析
     */
    analyze(): Promise<GraphData>;
    private getWorkspaceFolder;
}
export default JavaAnalyzer;
//# sourceMappingURL=JavaAnalyzer.d.ts.map