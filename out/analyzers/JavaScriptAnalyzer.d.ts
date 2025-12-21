import { GraphData } from '../utils/utils';
import { BaseAnalyzer, TypeDefinitions } from './BaseAnalyzer';
export declare class JavaScriptAnalyzer extends BaseAnalyzer {
    private supportedExtensions;
    private parserOptions;
    static get analyzerId(): string;
    static get displayName(): string;
    static getTypeDefinitions(): TypeDefinitions;
    constructor();
    analyze(): Promise<GraphData>;
    analyzeFile(filePath: string): Promise<GraphData>;
    private processFile;
    private createNode;
    private extractDependencies;
    private resolveDependency;
    private resolveWithExtensions;
    private tryFile;
    private readFile;
    private countLines;
    private hasLink;
    isFileSupported(filePath: string): boolean;
    private isSupportedFile;
    private getNodeId;
    private toRelative;
    private getWorkspaceFolder;
}
export default JavaScriptAnalyzer;
//# sourceMappingURL=JavaScriptAnalyzer.d.ts.map