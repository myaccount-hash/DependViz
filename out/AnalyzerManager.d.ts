import * as vscode from 'vscode';
import { BaseAnalyzer } from './analyzers/BaseAnalyzer';
import { ConfigurationManager } from './ConfigurationManager';
import { GraphData } from './utils/utils';
interface AnalyzerConstructor {
    new (context?: vscode.ExtensionContext): BaseAnalyzer;
    analyzerId: string;
    displayName: string;
    getTypeInfo(): import('./analyzers/BaseAnalyzer').TypeInfo[];
    getTypeDefaults(): import('./analyzers/BaseAnalyzer').TypeDefaults;
}
interface AnalyzerOption {
    id: string;
    label: string;
}
export declare class AnalyzerManager {
    private _configManager;
    private _analyzers;
    constructor(context: vscode.ExtensionContext, configManager: ConfigurationManager);
    private _createAnalyzers;
    static getAnalyzerClassById(analyzerId: string): AnalyzerConstructor;
    static getAnalyzerOptions(): AnalyzerOption[];
    static getDefaultAnalyzerId(): string;
    getActiveAnalyzer(): BaseAnalyzer;
    getActiveAnalyzerId(): string;
    getActiveAnalyzerName(): string;
    getAnalyzerName(analyzer: BaseAnalyzer): string;
    isFileSupported(filePath: string): boolean;
    analyzeProject(): Promise<GraphData | null>;
    analyzeFile(filePath: string): Promise<GraphData | null>;
    stopAll(): Promise<void>;
}
export {};
//# sourceMappingURL=AnalyzerManager.d.ts.map